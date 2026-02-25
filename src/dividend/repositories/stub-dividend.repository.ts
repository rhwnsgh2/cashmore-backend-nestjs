import type {
  IDividendRepository,
  SimulateResult,
} from '../interfaces/dividend-repository.interface';

export class StubDividendRepository implements IDividendRepository {
  private simulateResult: SimulateResult = {
    distribution: [],
    totalUsers: 0,
    totalReceipts: 0,
  };

  setSimulateResult(result: SimulateResult): void {
    this.simulateResult = result;
  }

  clear(): void {
    this.simulateResult = {
      distribution: [],
      totalUsers: 0,
      totalReceipts: 0,
    };
  }

  getSimulateData(
    _startDate: string,
    _endDate: string,
  ): Promise<SimulateResult> {
    return Promise.resolve(this.simulateResult);
  }
}
