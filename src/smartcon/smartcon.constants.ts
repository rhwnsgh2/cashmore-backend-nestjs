type SmartconEnv = 'dev' | 'op';
const ENV: SmartconEnv = 'op'; // dev 환경 미등록 — docs/gifticon/99-open-issues.md H 참고

const API_BASE_URLS: Record<SmartconEnv, string> = {
  dev: 'https://b2b-api-dev.giftsmartcon.com',
  op: 'https://b2b-api-prd.giftsmartcon.com',
};

const EVENT_IDS: Record<SmartconEnv, string> = {
  dev: '64385', // dev에는 아직 등록 안됨, 운영 시 별도 발급 가능성 있음
  op: '64385',
};

export const SMARTCON_CONFIG = {
  apiBaseUrl: API_BASE_URLS[ENV],
  eventId: EVENT_IDS[ENV],
  userId: 'bridgeworks', // 4.1 쿠폰생성 USER_ID (스마트콘이 발급)
  orderMobile: '07080804891', // 발신번호 (하이픈 없이)
};
