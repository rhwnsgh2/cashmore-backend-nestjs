export interface PendingAffiliateApproval {
  id: number;
  userId: string;
  pointAmount: number;
  merchantId: string;
}

export interface IAffiliateRepository {
  findPendingApprovals(
    beforeDate: string,
  ): Promise<PendingAffiliateApproval[]>;
  markCompleted(id: number, completedAt: string): Promise<void>;
}

export const AFFILIATE_REPOSITORY = Symbol('AFFILIATE_REPOSITORY');
