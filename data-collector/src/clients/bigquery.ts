import { BigQuery } from '@google-cloud/bigquery';
import {
  NormalizedRevenueHourly,
  NormalizedRevenueFillRate,
  NormalizedImpression,
} from '../collectors/applovin/types.js';

export interface BigQueryClientConfig {
  projectId: string;
  datasetId: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

export class BigQueryClient {
  private readonly client: BigQuery;
  private readonly datasetId: string;

  constructor(config: BigQueryClientConfig) {
    this.datasetId = config.datasetId;

    const options: ConstructorParameters<typeof BigQuery>[0] = {
      projectId: config.projectId,
    };

    if (config.credentials) {
      options.credentials = config.credentials;
    }

    this.client = new BigQuery(options);
  }

  /**
   * 시간별 수익 데이터 삽입 (max_placement 포함) - 배치 처리
   */
  async insertRevenueHourly(rows: NormalizedRevenueHourly[]): Promise<void> {
    if (rows.length === 0) {
      console.log('No revenue hourly data to insert');
      return;
    }

    const table = this.client.dataset(this.datasetId).table('revenue_hourly');
    const batchSize = 5000;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await table.insert(batch);
      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows to revenue_hourly`
      );
    }

    console.log(`Total inserted: ${rows.length} rows to revenue_hourly`);
  }

  /**
   * fill_rate 포함 수익 데이터 삽입 - 배치 처리
   */
  async insertRevenueFillRate(rows: NormalizedRevenueFillRate[]): Promise<void> {
    if (rows.length === 0) {
      console.log('No revenue fill rate data to insert');
      return;
    }

    const table = this.client
      .dataset(this.datasetId)
      .table('revenue_hourly_fill_rate');
    const batchSize = 5000;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await table.insert(batch);
      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows to revenue_hourly_fill_rate`
      );
    }

    console.log(`Total inserted: ${rows.length} rows to revenue_hourly_fill_rate`);
  }

  /**
   * 노출별 상세 데이터 삽입 (배치 처리)
   */
  async insertImpressions(rows: NormalizedImpression[]): Promise<void> {
    if (rows.length === 0) {
      console.log('No impression data to insert');
      return;
    }

    const table = this.client.dataset(this.datasetId).table('impressions');
    const batchSize = 5000;  // BigQuery 413 에러 방지를 위해 배치 크기 축소

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await table.insert(batch);
      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows`
      );
    }

    console.log(`Total inserted: ${rows.length} rows to impressions`);
  }

  /**
   * 데이터셋 및 테이블 생성 (초기 설정용)
   */
  async ensureTablesExist(): Promise<void> {
    const dataset = this.client.dataset(this.datasetId);

    // 데이터셋 존재 확인
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      await dataset.create();
      console.log(`Created dataset: ${this.datasetId}`);
    }

    // revenue_hourly 테이블 (max_placement 포함, attempts/responses/fill_rate 제외)
    await this.createTableIfNotExists('revenue_hourly', {
      fields: [
        { name: 'date', type: 'DATE', mode: 'REQUIRED' },
        { name: 'hour', type: 'INT64', mode: 'REQUIRED' },
        { name: 'platform', type: 'STRING', mode: 'REQUIRED' },
        { name: 'application', type: 'STRING', mode: 'NULLABLE' },
        { name: 'package_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ad_format', type: 'STRING', mode: 'NULLABLE' },
        { name: 'network', type: 'STRING', mode: 'NULLABLE' },
        { name: 'network_placement', type: 'STRING', mode: 'NULLABLE' },
        { name: 'country', type: 'STRING', mode: 'NULLABLE' },
        { name: 'device_type', type: 'STRING', mode: 'NULLABLE' },
        { name: 'max_ad_unit_id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'max_placement', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ad_unit_waterfall_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'impressions', type: 'INT64', mode: 'REQUIRED' },
        { name: 'estimated_revenue', type: 'NUMERIC', mode: 'REQUIRED' },
        { name: 'ecpm', type: 'NUMERIC', mode: 'REQUIRED' },
        { name: 'collected_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      ],
    });

    // revenue_hourly_fill_rate 테이블 (fill_rate 포함, max_placement 제외)
    await this.createTableIfNotExists('revenue_hourly_fill_rate', {
      fields: [
        { name: 'date', type: 'DATE', mode: 'REQUIRED' },
        { name: 'hour', type: 'INT64', mode: 'REQUIRED' },
        { name: 'platform', type: 'STRING', mode: 'REQUIRED' },
        { name: 'application', type: 'STRING', mode: 'NULLABLE' },
        { name: 'package_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ad_format', type: 'STRING', mode: 'NULLABLE' },
        { name: 'network', type: 'STRING', mode: 'NULLABLE' },
        { name: 'network_placement', type: 'STRING', mode: 'NULLABLE' },
        { name: 'country', type: 'STRING', mode: 'NULLABLE' },
        { name: 'device_type', type: 'STRING', mode: 'NULLABLE' },
        { name: 'max_ad_unit_id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ad_unit_waterfall_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'impressions', type: 'INT64', mode: 'REQUIRED' },
        { name: 'estimated_revenue', type: 'NUMERIC', mode: 'REQUIRED' },
        { name: 'ecpm', type: 'NUMERIC', mode: 'REQUIRED' },
        { name: 'attempts', type: 'INT64', mode: 'NULLABLE' },
        { name: 'responses', type: 'INT64', mode: 'NULLABLE' },
        { name: 'fill_rate', type: 'NUMERIC', mode: 'NULLABLE' },
        { name: 'collected_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      ],
    });

    // impressions 테이블
    await this.createTableIfNotExists('impressions', {
      fields: [
        { name: 'impression_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
        { name: 'ad_unit_id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ad_unit_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'waterfall', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ad_format', type: 'STRING', mode: 'NULLABLE' },
        { name: 'placement', type: 'STRING', mode: 'NULLABLE' },
        { name: 'country', type: 'STRING', mode: 'NULLABLE' },
        { name: 'device_type', type: 'STRING', mode: 'NULLABLE' },
        { name: 'idfa', type: 'STRING', mode: 'NULLABLE' },
        { name: 'idfv', type: 'STRING', mode: 'NULLABLE' },
        { name: 'user_id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'revenue', type: 'NUMERIC', mode: 'REQUIRED' },
        { name: 'network', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ad_placement', type: 'STRING', mode: 'NULLABLE' },
        { name: 'custom_data', type: 'STRING', mode: 'NULLABLE' },
        { name: 'platform', type: 'STRING', mode: 'REQUIRED' },
        { name: 'collected_date', type: 'DATE', mode: 'REQUIRED' },
      ],
    });
  }

  private async createTableIfNotExists(
    tableId: string,
    schema: { fields: Array<{ name: string; type: string; mode: string }> }
  ): Promise<void> {
    const table = this.client.dataset(this.datasetId).table(tableId);
    const [exists] = await table.exists();

    if (!exists) {
      await table.create({ schema });
      console.log(`Created table: ${tableId}`);
    }
  }

  /**
   * 중복 데이터 삭제 (재수집 시)
   * BigQuery streaming buffer에 데이터가 있으면 DELETE 불가 - 이 경우 skip
   * @returns true if deleted or no data, false if skipped due to streaming buffer
   */
  async deleteExistingData(
    tableName: 'revenue_hourly' | 'revenue_hourly_fill_rate' | 'impressions',
    date: string,
    platform?: string
  ): Promise<boolean> {
    const dateColumn = tableName === 'impressions' ? 'collected_date' : 'date';

    let query = `
      DELETE FROM \`${this.client.projectId}.${this.datasetId}.${tableName}\`
      WHERE ${dateColumn} = '${date}'
    `;

    if (platform) {
      query += ` AND platform = '${platform}'`;
    }

    try {
      await this.client.query(query);
      console.log(
        `Deleted existing data for ${date}${platform ? ` (${platform})` : ''} from ${tableName}`
      );
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('streaming buffer')) {
        console.log(
          `Skipping delete for ${date}${platform ? ` (${platform})` : ''} from ${tableName} - data in streaming buffer (will result in duplicates)`
        );
        return false;
      }
      throw error;
    }
  }
}
