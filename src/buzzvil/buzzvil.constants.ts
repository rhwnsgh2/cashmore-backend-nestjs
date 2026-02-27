type BuzzvilEnv = 'dev' | 'op';
const ENV: BuzzvilEnv = 'dev'; // 환경 전환 시 수동 변경

const API_BASE_URLS: Record<BuzzvilEnv, string> = {
  dev: 'https://screen-api-staging.buzzvil.com',
  op: 'https://screen-api.buzzvil.com',
};

const BUZZVIL_APPS = {
  aos: {
    op: { appId: '142459758898206', unitId: '345259941167008' },
    dev: { appId: '271055975934039', unitId: '321273326536299' },
  },
  ios: {
    op: { appId: '364993971094857', unitId: '194892578329014' },
    dev: { appId: '253365949409835', unitId: '457285848369665' },
  },
};

export const BUZZVIL_CONFIG = {
  aos: BUZZVIL_APPS.aos[ENV],
  ios: BUZZVIL_APPS.ios[ENV],
  apiBaseUrl: API_BASE_URLS[ENV],
};

export const BUZZVIL_POSTBACK_WHITELIST_IPS = [
  '13.231.21.93',
  '18.179.158.39',
  '52.68.114.43',
] as const;
