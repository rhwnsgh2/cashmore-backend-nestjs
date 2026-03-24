import type {
  IDaouApiClient,
  DaouMemberResult,
  DaouEarnPointResult,
} from '../interfaces/daou-api-client.interface';

export class StubDaouApiClient implements IDaouApiClient {
  private memberResult: DaouMemberResult = {
    success: true,
    data: {
      maskingId: 'nav***',
      point: 3500,
      userKey: 'test-user-key',
    },
  };

  private earnResult: DaouEarnPointResult = {
    success: true,
    txNo: 'test-tx-no-001',
  };

  setMemberResult(result: DaouMemberResult): void {
    this.memberResult = result;
  }

  setMemberSuccess(
    maskingId = 'nav***',
    point = 3500,
    userKey = 'test-user-key',
  ): void {
    this.memberResult = {
      success: true,
      data: { maskingId, point, userKey },
    };
  }

  setMemberFailure(errorCode: string, errorMessage = '실패'): void {
    this.memberResult = { success: false, errorCode, errorMessage };
  }

  setEarnResult(result: DaouEarnPointResult): void {
    this.earnResult = result;
  }

  setEarnSuccess(txNo = 'test-tx-no-001'): void {
    this.earnResult = { success: true, txNo };
  }

  setEarnFailure(errorCode: string, errorMessage = '적립 실패'): void {
    this.earnResult = { success: false, errorCode, errorMessage };
  }

  async lookupMember(_uniqueId: string): Promise<DaouMemberResult> {
    return this.memberResult;
  }

  async earnPoint(
    _userKey: string,
    _partnerTxNo: string,
    _point: number,
  ): Promise<DaouEarnPointResult> {
    return this.earnResult;
  }
}
