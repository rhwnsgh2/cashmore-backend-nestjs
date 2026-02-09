/**
 * 로컬 테스트 스크립트
 * 실행: bun run src/test-local.ts
 */

import { ApplovinClient } from './collectors/applovin/client.js';
import { format, subDays } from 'date-fns';

const APPLOVIN_API_KEY =
  'kOePZHulCpcuRoaHXrhrcRLKD9d3kMIwDhGmxE1LTVmN5_TQ95skfr9OcyOhS051RUNzXhyRxQniF9f8sb3G5o';

async function main() {
  const client = new ApplovinClient({
    apiKey: APPLOVIN_API_KEY,
    packageNames: {
      android: 'com.bridgeworks.cashmore',
      ios: 'com.bridgeworks.ios.cashmore',
    },
  });

  const now = new Date();
  const revenueDate = format(subDays(now, 1), 'yyyy-MM-dd');
  const userLevelDate = format(subDays(now, 2), 'yyyy-MM-dd');

  console.log('=== AppLovin API Test ===\n');

  // 1. Revenue Reporting API 테스트 (max_placement 포함)
  console.log(`1. Revenue Reporting API - max_placement (${revenueDate})`);
  try {
    const revenueData = await client.fetchRevenueHourly(revenueDate);
    console.log(`   ✅ Success: ${revenueData.length} rows`);
    if (revenueData.length > 0) {
      console.log('   Sample row:', JSON.stringify(revenueData[0], null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('');

  // 2. Revenue Fill Rate API 테스트 (fill_rate 포함)
  console.log(`2. Revenue Reporting API - fill_rate (${revenueDate})`);
  try {
    const fillRateData = await client.fetchRevenueFillRate(revenueDate);
    console.log(`   ✅ Success: ${fillRateData.length} rows`);
    if (fillRateData.length > 0) {
      console.log('   Sample row:', JSON.stringify(fillRateData[0], null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('');

  // 3. User-Level API 테스트 (Android) - 스트리밍
  console.log(`3. User-Level API - Android (${userLevelDate})`);
  try {
    let androidCount = 0;
    let androidSample: unknown = null;
    for await (const batch of client.fetchUserLevelImpressionsStream(
      userLevelDate,
      'android'
    )) {
      if (!androidSample && batch.length > 0) {
        androidSample = batch[0];
      }
      androidCount += batch.length;
      console.log(`   Batch: ${batch.length} rows (total: ${androidCount})`);
    }
    console.log(`   ✅ Success: ${androidCount} rows`);
    if (androidSample) {
      console.log('   Sample row:', JSON.stringify(androidSample, null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('');

  // 4. User-Level API 테스트 (iOS) - 스트리밍
  console.log(`4. User-Level API - iOS (${userLevelDate})`);
  try {
    let iosCount = 0;
    let iosSample: unknown = null;
    for await (const batch of client.fetchUserLevelImpressionsStream(
      userLevelDate,
      'ios'
    )) {
      if (!iosSample && batch.length > 0) {
        iosSample = batch[0];
      }
      iosCount += batch.length;
      console.log(`   Batch: ${batch.length} rows (total: ${iosCount})`);
    }
    console.log(`   ✅ Success: ${iosCount} rows`);
    if (iosSample) {
      console.log('   Sample row:', JSON.stringify(iosSample, null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
