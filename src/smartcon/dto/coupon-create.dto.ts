/**
 * 스마트콘 4.1 couponCreate.sc 응답 (XML, EUC-KR).
 * 성공/실패 케이스 모두 RESULTCODE/RESULTMSG는 항상 있고, 나머지는 성공 시만.
 */
export interface CouponCreateResponse {
  RESULTCODE: string; // '00' = 성공, 그 외 = 실패 (99/01/05/11/12/...)
  RESULTMSG: string;
  RECEIVERMOBILE?: string;
  BARCODE_NUM?: string;
  ORDER_ID?: string;
  USER_ID?: string;
  TR_ID?: string;
  EXP_DATE?: string; // 'YYYYMMDD'
}

export interface CouponCreateInput {
  goodsId: string;
  receiverMobile: string; // 하이픈 없는 번호
  trId: string; // 우리가 만든 거래번호 (50자 이내)
  title?: string; // MMS 제목 (옵션, EUC-KR)
  contents?: string; // MMS 본문 (옵션, EUC-KR)
}

export const SMARTCON_RESULT_CODE_SUCCESS = '00';
