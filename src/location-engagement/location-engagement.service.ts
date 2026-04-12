import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ILocationEngagementRepository } from './interfaces/location-engagement-repository.interface';
import { LOCATION_ENGAGEMENT_REPOSITORY } from './interfaces/location-engagement-repository.interface';

export interface RankingItem {
  rank: number;
  sigungu_code: string;
  sigungu_name: string;
  today_cumulative_count: number;
  yesterday_cumulative_count: number;
}

export interface LocationEngagementResult {
  date: string;
  time: string;
  rankings: RankingItem[];
  myRanking: RankingItem | null;
}

function formatSigunguName(name: string): string {
  const parts = name.split(' ');
  if (parts.length > 2) {
    return parts.slice(-2).join(' ');
  }
  return name;
}

@Injectable()
export class LocationEngagementService {
  constructor(
    @Inject(LOCATION_ENGAGEMENT_REPOSITORY)
    private repository: ILocationEngagementRepository,
  ) {}

  async getRankings(sigunguCode?: string): Promise<LocationEngagementResult> {
    const latest = await this.repository.findLatestTimestamp();
    if (!latest) {
      throw new NotFoundException('최신 데이터를 찾을 수 없습니다');
    }

    const stats = await this.repository.findByDateAndTime(
      latest.date,
      latest.time,
    );

    // yesterday_cumulative_count >= 5 필터링
    const filtered = stats.filter((s) => s.yesterday_cumulative_count >= 5);

    // 증가율 계산 + 내림차순 정렬
    const sorted = filtered
      .map((s) => ({
        ...s,
        changeRate:
          ((s.today_cumulative_count - s.yesterday_cumulative_count) /
            s.yesterday_cumulative_count) *
          100,
      }))
      .sort((a, b) => b.changeRate - a.changeRate);

    // 순위 부여
    const allRankings: RankingItem[] = sorted.map((s, i) => ({
      rank: i + 1,
      sigungu_code: s.sigungu_code,
      sigungu_name: formatSigunguName(s.sigungu_name),
      today_cumulative_count: s.today_cumulative_count,
      yesterday_cumulative_count: s.yesterday_cumulative_count,
    }));

    const top100 = allRankings.slice(0, 100);

    let myRanking: RankingItem | null = null;
    if (sigunguCode) {
      myRanking =
        allRankings.find((r) => r.sigungu_code === sigunguCode) || null;
    }

    return {
      date: latest.date,
      time: latest.time,
      rankings: top100,
      myRanking,
    };
  }
}
