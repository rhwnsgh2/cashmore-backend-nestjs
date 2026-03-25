const DEV_CONFIG = {
  partnerCode: 'PAWPTE',
  apiKey: 'RiyIK4kPtGwuTqVm9guZFRmz0VZLEwu8',
  encKey: 'lPdgiAOB1KmkAldwREDvhoGq8oywWjFh',
  apiUrl: 'https://test-box-api.addcon.co.kr',
};

export const DAOU_CONFIG = process.env.DAOU_PARTNER_CODE
  ? {
      partnerCode: process.env.DAOU_PARTNER_CODE,
      apiKey: process.env.DAOU_API_KEY!,
      encKey: process.env.DAOU_ENC_KEY!,
      apiUrl: process.env.DAOU_API_URL!,
    }
  : DEV_CONFIG;
