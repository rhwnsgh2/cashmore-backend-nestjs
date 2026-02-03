export interface StepLevelClaim {
  id: string;
  user_id: string;
  claim_date: string;
  level: number;
  required_steps: number;
  current_step_count: number;
  created_at: string;
}

export interface IStepRewardsRepository {
  findClaimsByUserAndDate(
    userId: string,
    date: string,
  ): Promise<StepLevelClaim[]>;

  findClaimByUserDateAndLevel(
    userId: string,
    date: string,
    level: number,
  ): Promise<StepLevelClaim | null>;

  findClaimByUserDateAndRequiredSteps(
    userId: string,
    date: string,
    requiredSteps: number,
  ): Promise<StepLevelClaim | null>;

  insertClaim(data: {
    user_id: string;
    claim_date: string;
    level: number;
    required_steps: number;
    current_step_count: number;
  }): Promise<StepLevelClaim>;
}

export const STEP_REWARDS_REPOSITORY = Symbol('STEP_REWARDS_REPOSITORY');
