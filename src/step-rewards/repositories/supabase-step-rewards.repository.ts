import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IStepRewardsRepository,
  StepLevelClaim,
} from '../interfaces/step-rewards-repository.interface';

@Injectable()
export class SupabaseStepRewardsRepository implements IStepRewardsRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findClaimsByUserAndDate(
    userId: string,
    date: string,
  ): Promise<StepLevelClaim[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('step_level_claims')
      .select('*')
      .eq('user_id', userId)
      .eq('claim_date', date);

    if (error) {
      throw new Error(`Failed to fetch claims: ${error.message}`);
    }

    return (data ?? []) as StepLevelClaim[];
  }

  async findClaimByUserDateAndLevel(
    userId: string,
    date: string,
    level: number,
  ): Promise<StepLevelClaim | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('step_level_claims')
      .select('*')
      .eq('user_id', userId)
      .eq('claim_date', date)
      .eq('level', level)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch claim: ${error.message}`);
    }

    return data as StepLevelClaim;
  }

  async findClaimByUserDateAndRequiredSteps(
    userId: string,
    date: string,
    requiredSteps: number,
  ): Promise<StepLevelClaim | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('step_level_claims')
      .select('*')
      .eq('user_id', userId)
      .eq('claim_date', date)
      .eq('required_steps', requiredSteps)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch claim: ${error.message}`);
    }

    return data as StepLevelClaim;
  }

  async insertClaim(data: {
    user_id: string;
    claim_date: string;
    level: number;
    required_steps: number;
    current_step_count: number;
  }): Promise<StepLevelClaim> {
    const { data: inserted, error } = await this.supabaseService
      .getClient()
      .from('step_level_claims')
      .insert(data as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert claim: ${error.message}`);
    }

    return inserted as StepLevelClaim;
  }
}
