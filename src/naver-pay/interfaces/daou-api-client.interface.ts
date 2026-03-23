export interface DaouMemberInfo {
  maskingId: string;
  point: number;
  userKey: string;
}

export type DaouMemberResult =
  | { success: true; data: DaouMemberInfo }
  | { success: false; errorCode: string };

export interface IDaouApiClient {
  lookupMember(uniqueId: string): Promise<DaouMemberResult>;
}

export const DAOU_API_CLIENT = Symbol('DAOU_API_CLIENT');
