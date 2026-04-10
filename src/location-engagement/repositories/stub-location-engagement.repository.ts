import type {
  ILocationEngagementRepository,
  LatestTimestamp,
  LocationEngagementRow,
} from '../interfaces/location-engagement-repository.interface';

export class StubLocationEngagementRepository
  implements ILocationEngagementRepository
{
  private latestTimestamp: LatestTimestamp | null = null;
  private rows: Map<string, LocationEngagementRow[]> = new Map();

  setLatestTimestamp(ts: LatestTimestamp | null): void {
    this.latestTimestamp = ts;
  }

  setRows(date: string, time: string, rows: LocationEngagementRow[]): void {
    this.rows.set(`${date}|${time}`, rows);
  }

  clear(): void {
    this.latestTimestamp = null;
    this.rows.clear();
  }

  findLatestTimestamp(): Promise<LatestTimestamp | null> {
    return Promise.resolve(this.latestTimestamp);
  }

  findByDateAndTime(
    date: string,
    time: string,
  ): Promise<LocationEngagementRow[]> {
    return Promise.resolve(this.rows.get(`${date}|${time}`) || []);
  }
}
