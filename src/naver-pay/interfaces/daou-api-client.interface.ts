export interface DaouMemberInfo {
  maskingId: string;
  point: number;
  userKey: string;
}

export type DaouMemberResult =
  | { success: true; data: DaouMemberInfo }
  | { success: false; errorCode: string; errorMessage: string };

export type DaouEarnPointResult =
  | { success: true; txNo: string }
  | { success: false; errorCode: string; errorMessage: string };

export interface IDaouApiClient {
  lookupMember(uniqueId: string): Promise<DaouMemberResult>;
  earnPoint(
    userKey: string,
    partnerTxNo: string,
    point: number,
  ): Promise<DaouEarnPointResult>;
}

export const DAOU_API_CLIENT = Symbol('DAOU_API_CLIENT');
