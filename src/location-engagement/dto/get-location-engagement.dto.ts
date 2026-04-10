import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RankingItemDto {
  @ApiProperty({ description: '순위', example: 1 })
  rank: number;

  @ApiProperty({ description: '시군구 코드', example: '11010' })
  sigungu_code: string;

  @ApiProperty({ description: '시군구 이름', example: '서울특별시 종로구' })
  sigungu_name: string;

  @ApiProperty({ description: '오늘 누적 수', example: 120 })
  today_cumulative_count: number;

  @ApiProperty({ description: '어제 누적 수', example: 100 })
  yesterday_cumulative_count: number;
}

export class LocationEngagementResponseDto {
  @ApiProperty({ description: '기준 날짜', example: '2026-04-09' })
  date: string;

  @ApiProperty({ description: '기준 시간', example: '14:00' })
  time: string;

  @ApiProperty({
    type: [RankingItemDto],
    description: '상위 100개 랭킹',
  })
  rankings: RankingItemDto[];

  @ApiPropertyOptional({
    type: RankingItemDto,
    description: '내 시군구 랭킹',
    nullable: true,
  })
  myRanking: RankingItemDto | null;
}
