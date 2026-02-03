import type {
  IStepRewardsRepository,
  StepLevelClaim,
} from '../interfaces/step-rewards-repository.interface';

export class StubStepRewardsRepository implements IStepRewardsRepository {
  private claims: StepLevelClaim[] = [];
  private idCounter = 1;

  setClaims(claims: StepLevelClaim[]): void {
    this.claims = claims;
  }

  addClaim(claim: Omit<StepLevelClaim, 'id' | 'created_at'>): StepLevelClaim {
    const newClaim: StepLevelClaim = {
      ...claim,
      id: `stub-claim-${this.idCounter++}`,
      created_at: new Date().toISOString(),
    };
    this.claims.push(newClaim);
    return newClaim;
  }

  clear(): void {
    this.claims = [];
    this.idCounter = 1;
  }

  findClaimsByUserAndDate(
    userId: string,
    date: string,
  ): Promise<StepLevelClaim[]> {
    return Promise.resolve(
      this.claims.filter(
        (c) => c.user_id === userId && c.claim_date === date,
      ),
    );
  }

  findClaimByUserDateAndLevel(
    userId: string,
    date: string,
    level: number,
  ): Promise<StepLevelClaim | null> {
    return Promise.resolve(
      this.claims.find(
        (c) =>
          c.user_id === userId && c.claim_date === date && c.level === level,
      ) ?? null,
    );
  }

  findClaimByUserDateAndRequiredSteps(
    userId: string,
    date: string,
    requiredSteps: number,
  ): Promise<StepLevelClaim | null> {
    return Promise.resolve(
      this.claims.find(
        (c) =>
          c.user_id === userId &&
          c.claim_date === date &&
          c.required_steps === requiredSteps,
      ) ?? null,
    );
  }

  insertClaim(data: {
    user_id: string;
    claim_date: string;
    level: number;
    required_steps: number;
    current_step_count: number;
  }): Promise<StepLevelClaim> {
    const newClaim: StepLevelClaim = {
      ...data,
      id: `stub-claim-${this.idCounter++}`,
      created_at: new Date().toISOString(),
    };
    this.claims.push(newClaim);
    return Promise.resolve(newClaim);
  }
}
