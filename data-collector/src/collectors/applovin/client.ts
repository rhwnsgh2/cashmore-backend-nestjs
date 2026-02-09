import {
  RevenueReportResponse,
  RevenueReportRow,
  UserLevelApiResponse,
  NormalizedRevenueHourly,
  NormalizedRevenueFillRate,
  NormalizedImpression,
} from './types.js';

export interface ApplovinClientConfig {
  apiKey: string;
  packageNames: {
    android: string;
    ios: string;
  };
}

export class ApplovinClient {
  private readonly apiKey: string;
  private readonly packageNames: { android: string; ios: string };

  constructor(config: ApplovinClientConfig) {
    this.apiKey = config.apiKey;
    this.packageNames = config.packageNames;
  }

  /**
   * Revenue Reporting API - 시간별 집계 데이터 조회 (max_placement 포함)
   * 주의: max_placement는 attempts, responses, fill_rate와 함께 사용 불가
   */
  async fetchRevenueHourly(date: string): Promise<NormalizedRevenueHourly[]> {
    const columns = [
      'day',
      'hour',
      'platform',
      'application',
      'package_name',
      'ad_format',
      'network',
      'network_placement',
      'country',
      'device_type',
      'max_ad_unit_id',
      'max_placement',
      'ad_unit_waterfall_name',
      'impressions',
      'estimated_revenue',
      'ecpm',
    ].join(',');

    const params = new URLSearchParams({
      api_key: this.apiKey,
      columns,
      start: date,
      end: this.getNextDay(date),
      format: 'json',
    });

    const url = `https://r.applovin.com/maxReport?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Revenue Reporting API error: ${response.status} - ${text}`
      );
    }

    const data = (await response.json()) as RevenueReportResponse;

    if (data.code !== 200) {
      throw new Error(`Revenue Reporting API returned code: ${data.code}`);
    }

    return this.normalizeRevenueData(data.results);
  }

  /**
   * Revenue Reporting API - fill_rate 포함 데이터 조회 (max_placement 제외)
   */
  async fetchRevenueFillRate(date: string): Promise<NormalizedRevenueFillRate[]> {
    const columns = [
      'day',
      'hour',
      'platform',
      'application',
      'package_name',
      'ad_format',
      'network',
      'network_placement',
      'country',
      'device_type',
      'max_ad_unit_id',
      'ad_unit_waterfall_name',
      'impressions',
      'estimated_revenue',
      'ecpm',
      'attempts',
      'responses',
      'fill_rate',
    ].join(',');

    const params = new URLSearchParams({
      api_key: this.apiKey,
      columns,
      start: date,
      end: this.getNextDay(date),
      format: 'json',
    });

    const url = `https://r.applovin.com/maxReport?${params}`;
    const response = await fetch(url);

    const data = (await response.json()) as RevenueReportResponse;

    if (!response.ok) {
      throw new Error(
        `Revenue Fill Rate API error: ${response.status} - ${JSON.stringify(data)}`
      );
    }

    if (data.code !== 200) {
      throw new Error(`Revenue Fill Rate API returned code: ${data.code}`);
    }

    return this.normalizeRevenueFillRateData(data.results);
  }

  /**
   * User-Level Ad Revenue API - 스트리밍 방식으로 노출별 상세 데이터 조회
   * CSV를 전체 문자열로 로드하지 않고, chunk 단위로 읽으며 배치 yield
   */
  async *fetchUserLevelImpressionsStream(
    date: string,
    platform: 'android' | 'ios',
    batchSize: number = 5000
  ): AsyncGenerator<NormalizedImpression[]> {
    const packageName = this.packageNames[platform];

    const params = new URLSearchParams({
      api_key: this.apiKey,
      date,
      platform,
      application: packageName,
      aggregated: 'false',
    });

    const url = `https://r.applovin.com/max/userAdRevenueReport?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`User-Level API error: ${response.status}`);
    }

    const data = (await response.json()) as UserLevelApiResponse;

    if (data.status !== 200) {
      throw new Error(`User-Level API returned status: ${data.status}`);
    }

    const csvUrl = data.ad_revenue_report_url || data.url;

    if (!csvUrl) {
      console.log(`No data available for ${platform} on ${date}`);
      return;
    }

    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      throw new Error(`CSV download error: ${csvResponse.status}`);
    }

    if (!csvResponse.body) {
      throw new Error('CSV response body is null');
    }

    const reader = csvResponse.body.getReader();
    const decoder = new TextDecoder();

    let headers: string[] | null = null;
    let buffer = '';
    let batch: NormalizedImpression[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        if (buffer.trim() && headers) {
          batch.push(this.normalizeImpressionRow(
            this.parseCsvLineToRecord(buffer, headers),
            platform,
            date,
          ));
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;

        if (!headers) {
          headers = this.parseCsvLine(line);
          continue;
        }

        batch.push(this.normalizeImpressionRow(
          this.parseCsvLineToRecord(line, headers),
          platform,
          date,
        ));

        if (batch.length >= batchSize) {
          yield batch;
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  private parseCsvLineToRecord(
    line: string,
    headers: string[],
  ): Record<string, string> {
    const values = this.parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  }

  private normalizeImpressionRow(
    row: Record<string, string>,
    platform: string,
    collectedDate: string,
  ): NormalizedImpression {
    return {
      impression_at: row['Date'] || collectedDate,
      ad_unit_id: row['Ad Unit ID'] || null,
      ad_unit_name: row['Ad Unit Name'] || null,
      waterfall: row['Waterfall'] || null,
      ad_format: row['Ad Format'] || null,
      placement: row['Placement'] || null,
      country: row['Country'] || null,
      device_type: row['Device Type'] || null,
      idfa: row['IDFA'] || null,
      idfv: row['IDFV'] || null,
      user_id: row['User ID'] || null,
      revenue: parseFloat(row['Revenue']) || 0,
      network: row['Network'] || null,
      ad_placement: row['Ad Placement'] || null,
      custom_data: row['Custom Data'] || null,
      platform,
      collected_date: collectedDate,
    };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private normalizeRevenueData(
    rows: RevenueReportRow[]
  ): NormalizedRevenueHourly[] {
    const now = new Date().toISOString();

    return rows.map((row) => ({
      date: row.day,
      hour: row.hour ? parseInt(row.hour.split(':')[0], 10) : 0,
      platform: row.platform || 'unknown',
      application: row.application || null,
      package_name: row.package_name || null,
      ad_format: row.ad_format || null,
      network: row.network || null,
      network_placement: row.network_placement || null,
      country: row.country || null,
      device_type: row.device_type || null,
      max_ad_unit_id: row.max_ad_unit_id || null,
      max_placement: row.max_placement || null,
      ad_unit_waterfall_name: row.ad_unit_waterfall_name || null,
      impressions: parseInt(row.impressions || '0', 10),
      estimated_revenue: Number(parseFloat(row.estimated_revenue || '0').toFixed(9)),
      ecpm: Number(parseFloat(row.ecpm || '0').toFixed(9)),
      collected_at: now,
    }));
  }

  private normalizeRevenueFillRateData(
    rows: RevenueReportRow[]
  ): NormalizedRevenueFillRate[] {
    const now = new Date().toISOString();

    return rows.map((row) => ({
      date: row.day,
      hour: row.hour ? parseInt(row.hour.split(':')[0], 10) : 0,
      platform: row.platform || 'unknown',
      application: row.application || null,
      package_name: row.package_name || null,
      ad_format: row.ad_format || null,
      network: row.network || null,
      network_placement: row.network_placement || null,
      country: row.country || null,
      device_type: row.device_type || null,
      max_ad_unit_id: row.max_ad_unit_id || null,
      ad_unit_waterfall_name: row.ad_unit_waterfall_name || null,
      impressions: parseInt(row.impressions || '0', 10),
      estimated_revenue: Number(parseFloat(row.estimated_revenue || '0').toFixed(9)),
      ecpm: Number(parseFloat(row.ecpm || '0').toFixed(9)),
      attempts: row.attempts ? parseInt(row.attempts, 10) : null,
      responses: row.responses ? parseInt(row.responses, 10) : null,
      fill_rate: row.fill_rate ? parseFloat(row.fill_rate) : null,
      collected_at: now,
    }));
  }

  private getNextDay(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
}
