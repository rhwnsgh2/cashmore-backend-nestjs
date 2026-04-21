import type {
  IPartnerProgramRepository,
  PartnerProgram,
} from '../interfaces/partner-program-repository.interface';

export class StubPartnerProgramRepository implements IPartnerProgramRepository {
  private programs: PartnerProgram[] = [];

  setProgram(program: PartnerProgram): void {
    this.programs.push(program);
  }

  clear(): void {
    this.programs = [];
  }

  findActiveProgram(
    userId: string,
    now: Date,
  ): Promise<PartnerProgram | null> {
    const nowMs = now.getTime();
    const found = this.programs.find(
      (p) =>
        p.userId === userId &&
        new Date(p.startsAt).getTime() <= nowMs &&
        nowMs <= new Date(p.endsAt).getTime(),
    );
    return Promise.resolve(found ?? null);
  }
}
