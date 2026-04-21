import type {
  IPartnerProgramRepository,
  PartnerProgram,
} from '../interfaces/partner-program-repository.interface';

export class StubPartnerProgramRepository implements IPartnerProgramRepository {
  private programs: PartnerProgram[] = [];
  private nextId = 1;

  setProgram(program: PartnerProgram): void {
    this.programs.push(program);
    if (program.id >= this.nextId) this.nextId = program.id + 1;
  }

  clear(): void {
    this.programs = [];
    this.nextId = 1;
  }

  findActiveProgram(userId: string, now: Date): Promise<PartnerProgram | null> {
    const nowMs = now.getTime();
    const found = this.programs.find(
      (p) =>
        p.userId === userId &&
        new Date(p.startsAt).getTime() <= nowMs &&
        nowMs <= new Date(p.endsAt).getTime(),
    );
    return Promise.resolve(found ?? null);
  }

  findOverlappingUserIds(
    userIds: string[],
    startsAt: string,
    endsAt: string,
  ): Promise<string[]> {
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    const set = new Set<string>();
    for (const p of this.programs) {
      if (!userIds.includes(p.userId)) continue;
      const pStart = new Date(p.startsAt).getTime();
      const pEnd = new Date(p.endsAt).getTime();
      const overlaps = !(pEnd < startMs || pStart > endMs);
      if (overlaps) set.add(p.userId);
    }
    return Promise.resolve(Array.from(set));
  }

  createMany(
    rows: { userId: string; startsAt: string; endsAt: string }[],
  ): Promise<number> {
    for (const r of rows) {
      this.programs.push({
        id: this.nextId++,
        userId: r.userId,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
      });
    }
    return Promise.resolve(rows.length);
  }

  getAll(): PartnerProgram[] {
    return this.programs;
  }
}
