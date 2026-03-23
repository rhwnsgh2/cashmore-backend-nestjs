import type {
  IDaouApiClient,
  DaouMemberResult,
} from '../interfaces/daou-api-client.interface';

export class StubDaouApiClient implements IDaouApiClient {
  private result: DaouMemberResult = {
    success: true,
    data: {
      maskingId: 'nav***',
      point: 3500,
      userKey: 'test-user-key',
    },
  };

  setResult(result: DaouMemberResult): void {
    this.result = result;
  }

  setSuccess(
    maskingId = 'nav***',
    point = 3500,
    userKey = 'test-user-key',
  ): void {
    this.result = {
      success: true,
      data: { maskingId, point, userKey },
    };
  }

  setFailure(errorCode: string): void {
    this.result = { success: false, errorCode };
  }

  async lookupMember(_uniqueId: string): Promise<DaouMemberResult> {
    return this.result;
  }
}
