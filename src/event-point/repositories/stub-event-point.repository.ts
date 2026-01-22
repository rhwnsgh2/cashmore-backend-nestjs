import {
  IEventPointRepository,
  EventPoint,
} from '../interfaces/event-point-repository.interface';

export class StubEventPointRepository implements IEventPointRepository {
  private eventPoints = new Map<string, EventPoint[]>();

  setEventPoints(userId: string, points: EventPoint[]): void {
    this.eventPoints.set(userId, points);
  }

  clear(): void {
    this.eventPoints.clear();
  }

  findByUserId(userId: string): Promise<EventPoint[]> {
    const points = this.eventPoints.get(userId) || [];
    const sortedPoints = [...points].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return Promise.resolve(sortedPoints);
  }
}
