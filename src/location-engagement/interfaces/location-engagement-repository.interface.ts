export interface LatestTimestamp {
  date: string;
  time: string;
}

export interface LocationEngagementRow {
  sigungu_code: string;
  sigungu_name: string;
  today_cumulative_count: number;
  yesterday_cumulative_count: number;
}

export interface ILocationEngagementRepository {
  findLatestTimestamp(): Promise<LatestTimestamp | null>;

  findByDateAndTime(
    date: string,
    time: string,
  ): Promise<LocationEngagementRow[]>;
}

export const LOCATION_ENGAGEMENT_REPOSITORY = Symbol(
  'LOCATION_ENGAGEMENT_REPOSITORY',
);
