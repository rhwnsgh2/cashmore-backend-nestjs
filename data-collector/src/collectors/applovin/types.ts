// Revenue Reporting API 응답 타입
export interface RevenueReportRow {
  day: string;
  hour?: string;
  platform?: string;
  application?: string;
  package_name?: string;
  ad_format?: string;
  network?: string;
  network_placement?: string;
  country?: string;
  device_type?: string;
  max_ad_unit_id?: string;
  max_placement?: string;
  ad_unit_waterfall_name?: string;
  impressions?: string;
  estimated_revenue?: string;
  ecpm?: string;
  attempts?: string;
  responses?: string;
  fill_rate?: string;
}

export interface RevenueReportResponse {
  code: number;
  count: number;
  results: RevenueReportRow[];
}

// User-Level API 응답 타입
export interface UserLevelApiResponse {
  status: number;
  url?: string;
  ad_revenue_report_url?: string;
  fb_estimated_revenue_url?: string;
}

// User-Level CSV 데이터 (aggregated=false)
export interface UserLevelImpressionRow {
  Date: string;
  'Ad Unit ID': string;
  'Ad Unit Name': string;
  Waterfall: string;
  'Ad Format': string;
  Placement: string;
  Country: string;
  'Device Type': string;
  IDFA: string;
  IDFV: string;
  'User ID': string;
  Revenue: string;
  Network?: string;
  'Ad Placement': string;
  'Custom Data'?: string;
}

// BigQuery용 정규화된 타입

// revenue_hourly 테이블 - max_placement 포함 (attempts, responses, fill_rate 제외)
export interface NormalizedRevenueHourly {
  date: string;
  hour: number;
  platform: string;
  application: string | null;
  package_name: string | null;
  ad_format: string | null;
  network: string | null;
  network_placement: string | null;
  country: string | null;
  device_type: string | null;
  max_ad_unit_id: string | null;
  max_placement: string | null;
  ad_unit_waterfall_name: string | null;
  impressions: number;
  estimated_revenue: number;
  ecpm: number;
  collected_at: string;
}

// revenue_hourly_fill_rate 테이블 - fill_rate 포함 (max_placement 제외)
export interface NormalizedRevenueFillRate {
  date: string;
  hour: number;
  platform: string;
  application: string | null;
  package_name: string | null;
  ad_format: string | null;
  network: string | null;
  network_placement: string | null;
  country: string | null;
  device_type: string | null;
  max_ad_unit_id: string | null;
  ad_unit_waterfall_name: string | null;
  impressions: number;
  estimated_revenue: number;
  ecpm: number;
  attempts: number | null;
  responses: number | null;
  fill_rate: number | null;
  collected_at: string;
}

export interface NormalizedImpression {
  impression_at: string;
  ad_unit_id: string | null;
  ad_unit_name: string | null;
  waterfall: string | null;
  ad_format: string | null;
  placement: string | null;
  country: string | null;
  device_type: string | null;
  idfa: string | null;
  idfv: string | null;
  user_id: string | null;
  revenue: number;
  network: string | null;
  ad_placement: string | null;
  custom_data: string | null;
  platform: string;
  collected_date: string;
}
