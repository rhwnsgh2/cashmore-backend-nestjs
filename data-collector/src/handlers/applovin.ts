import { Handler, ScheduledEvent } from 'aws-lambda';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { subDays, format } from 'date-fns';
import { ApplovinClient } from '../collectors/applovin/client.js';
import { BigQueryClient } from '../clients/bigquery.js';

const secretsClient = new SecretsManagerClient({ region: 'ap-northeast-2' });

// 캐시된 시크릿 값
let cachedApplovinApiKey: string | null = null;
let cachedBigQueryCredentials: {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null = null;

async function getApplovinApiKey(): Promise<string> {
  if (cachedApplovinApiKey) {
    return cachedApplovinApiKey;
  }

  const secretArn = process.env.APPLOVIN_API_KEY_SECRET_ARN;
  if (!secretArn) {
    throw new Error('APPLOVIN_API_KEY_SECRET_ARN is required');
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  if (!response.SecretString) {
    throw new Error('Failed to retrieve AppLovin API key');
  }

  // 시크릿이 JSON 형식인 경우 파싱
  try {
    const parsed = JSON.parse(response.SecretString);
    cachedApplovinApiKey = parsed.apiKey || parsed.api_key || response.SecretString;
  } catch {
    cachedApplovinApiKey = response.SecretString;
  }

  return cachedApplovinApiKey!;
}

async function getBigQueryCredentials(): Promise<{
  projectId: string;
  clientEmail: string;
  privateKey: string;
}> {
  if (cachedBigQueryCredentials) {
    return cachedBigQueryCredentials;
  }

  const secretArn = process.env.BIGQUERY_SECRET_ARN;
  if (!secretArn) {
    throw new Error('BIGQUERY_SECRET_ARN is required');
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  if (!response.SecretString) {
    throw new Error('Failed to retrieve BigQuery credentials');
  }

  const parsed = JSON.parse(response.SecretString);

  cachedBigQueryCredentials = {
    projectId: parsed.project_id || parsed.projectId,
    clientEmail: parsed.client_email || parsed.clientEmail,
    privateKey: parsed.private_key || parsed.privateKey,
  };

  return cachedBigQueryCredentials!;
}

export const handler: Handler<ScheduledEvent> = async (event) => {
  console.log('AppLovin data collection started', { event });

  // 시크릿 가져오기
  const applovinApiKey = await getApplovinApiKey();
  const bqCredentials = await getBigQueryCredentials();

  const androidPackage =
    process.env.ANDROID_PACKAGE_NAME || 'com.bridgeworks.cashmore';
  const iosPackage =
    process.env.IOS_PACKAGE_NAME || 'com.bridgeworks.ios.cashmore';
  const bqDatasetId = process.env.BIGQUERY_DATASET_ID || 'applovin';

  const applovinClient = new ApplovinClient({
    apiKey: applovinApiKey,
    packageNames: {
      android: androidPackage,
      ios: iosPackage,
    },
  });

  const bigqueryClient = new BigQueryClient({
    projectId: bqCredentials.projectId,
    datasetId: bqDatasetId,
    credentials: {
      client_email: bqCredentials.clientEmail,
      private_key: bqCredentials.privateKey,
    },
  });

  // 테이블이 없으면 생성
  console.log('Ensuring BigQuery tables exist...');
  await bigqueryClient.ensureTablesExist();

  const now = new Date();

  // Revenue Reporting API: D-1 (어제)
  const revenueDate = format(subDays(now, 1), 'yyyy-MM-dd');

  // User-Level API: D-2 (그저께) - 8시간 지연 고려
  const userLevelDate = format(subDays(now, 2), 'yyyy-MM-dd');

  const results = {
    revenueHourly: { success: false, count: 0, error: null as string | null },
    revenueFillRate: { success: false, count: 0, error: null as string | null },
    impressions: {
      android: { success: false, count: 0, error: null as string | null },
      ios: { success: false, count: 0, error: null as string | null },
    },
  };

  // 1. Revenue Reporting API 데이터 수집 (max_placement 포함)
  try {
    console.log(`Fetching revenue hourly data for ${revenueDate}`);

    // 기존 데이터 삭제 (중복 방지) - streaming buffer 에러 시 skip
    const deleted = await bigqueryClient.deleteExistingData('revenue_hourly', revenueDate);
    if (!deleted) {
      console.log('Skipping revenue hourly collection - data in streaming buffer');
      results.revenueHourly.error = 'Skipped - data in streaming buffer';
    } else {
      const revenueData = await applovinClient.fetchRevenueHourly(revenueDate);
      await bigqueryClient.insertRevenueHourly(revenueData);

      results.revenueHourly.success = true;
      results.revenueHourly.count = revenueData.length;

      console.log(`Revenue hourly: ${revenueData.length} rows inserted`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    results.revenueHourly.error = errorMessage;
    console.error('Revenue hourly collection failed:', errorMessage);
  }

  // 2. Revenue Fill Rate API 데이터 수집 (fill_rate 포함)
  try {
    console.log(`Fetching revenue fill rate data for ${revenueDate}`);

    // 기존 데이터 삭제 (중복 방지) - streaming buffer 에러 시 skip
    const deleted = await bigqueryClient.deleteExistingData(
      'revenue_hourly_fill_rate',
      revenueDate
    );
    if (!deleted) {
      console.log('Skipping revenue fill rate collection - data in streaming buffer');
      results.revenueFillRate.error = 'Skipped - data in streaming buffer';
    } else {
      const fillRateData = await applovinClient.fetchRevenueFillRate(revenueDate);
      await bigqueryClient.insertRevenueFillRate(fillRateData);

      results.revenueFillRate.success = true;
      results.revenueFillRate.count = fillRateData.length;

      console.log(`Revenue fill rate: ${fillRateData.length} rows inserted`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    results.revenueFillRate.error = errorMessage;
    console.error('Revenue fill rate collection failed:', errorMessage);
  }

  // 3. User-Level API 데이터 수집 (Android) - 스트리밍 처리
  try {
    console.log(`Fetching Android impressions for ${userLevelDate}`);

    // 기존 데이터 삭제 (플랫폼별로 중복 방지) - streaming buffer 에러 시 skip
    const deleted = await bigqueryClient.deleteExistingData('impressions', userLevelDate, 'android');
    if (!deleted) {
      console.log('Skipping Android impressions collection - data in streaming buffer');
      results.impressions.android.error = 'Skipped - data in streaming buffer';
    } else {
      let androidTotal = 0;
      for await (const batch of applovinClient.fetchUserLevelImpressionsStream(
        userLevelDate,
        'android'
      )) {
        await bigqueryClient.insertImpressions(batch);
        androidTotal += batch.length;
      }

      results.impressions.android.success = true;
      results.impressions.android.count = androidTotal;

      console.log(`Android impressions: ${androidTotal} rows inserted`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    results.impressions.android.error = errorMessage;
    console.error('Android impressions collection failed:', errorMessage);
  }

  // 4. User-Level API 데이터 수집 (iOS) - 스트리밍 처리
  try {
    console.log(`Fetching iOS impressions for ${userLevelDate}`);

    // 기존 데이터 삭제 (플랫폼별로 중복 방지) - streaming buffer 에러 시 skip
    const deleted = await bigqueryClient.deleteExistingData('impressions', userLevelDate, 'ios');
    if (!deleted) {
      console.log('Skipping iOS impressions collection - data in streaming buffer');
      results.impressions.ios.error = 'Skipped - data in streaming buffer';
    } else {
      let iosTotal = 0;
      for await (const batch of applovinClient.fetchUserLevelImpressionsStream(
        userLevelDate,
        'ios'
      )) {
        await bigqueryClient.insertImpressions(batch);
        iosTotal += batch.length;
      }

      results.impressions.ios.success = true;
      results.impressions.ios.count = iosTotal;

      console.log(`iOS impressions: ${iosTotal} rows inserted`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    results.impressions.ios.error = errorMessage;
    console.error('iOS impressions collection failed:', errorMessage);
  }

  console.log('AppLovin data collection completed', results);

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};
