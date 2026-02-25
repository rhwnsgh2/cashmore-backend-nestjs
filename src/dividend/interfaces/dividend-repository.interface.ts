export interface SimulateDistributionItem {
  receiptCount: number;
  userCount: number;
}

export interface SimulateResult {
  distribution: SimulateDistributionItem[];
  totalUsers: number;
  totalReceipts: number;
}

export interface IDividendRepository {
  getSimulateData(
    startDate: string,
    endDate: string,
  ): Promise<SimulateResult>;
}

export const DIVIDEND_REPOSITORY = Symbol('DIVIDEND_REPOSITORY');
