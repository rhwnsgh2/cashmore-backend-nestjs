export interface PartnerProgram {
  id: number;
  userId: string;
  startsAt: string;
  endsAt: string;
}

export interface IPartnerProgramRepository {
  findActiveProgram(userId: string, now: Date): Promise<PartnerProgram | null>;

  findOverlappingUserIds(
    userIds: string[],
    startsAt: string,
    endsAt: string,
  ): Promise<string[]>;

  createMany(
    rows: { userId: string; startsAt: string; endsAt: string }[],
  ): Promise<number>;
}

export const PARTNER_PROGRAM_REPOSITORY = Symbol('PARTNER_PROGRAM_REPOSITORY');
