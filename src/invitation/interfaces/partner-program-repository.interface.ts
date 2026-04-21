export interface PartnerProgram {
  id: number;
  userId: string;
  startsAt: string;
  endsAt: string;
}

export interface IPartnerProgramRepository {
  findActiveProgram(
    userId: string,
    now: Date,
  ): Promise<PartnerProgram | null>;
}

export const PARTNER_PROGRAM_REPOSITORY = Symbol('PARTNER_PROGRAM_REPOSITORY');
