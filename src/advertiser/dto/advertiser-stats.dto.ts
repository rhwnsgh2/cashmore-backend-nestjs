import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdDailyStatDto {
  @ApiProperty({ description: '광고 ID', example: 1 })
  adId: number;

  @ApiProperty({ description: '광고 제목', example: '여름 프로모션 배너' })
  adTitle: string;

  @ApiProperty({ description: '통계 날짜', example: '2026-04-10' })
  date: string;

  @ApiProperty({ description: '노출 수', example: 1500 })
  impressions: number;

  @ApiProperty({ description: '클릭 수', example: 45 })
  clicks: number;

  @ApiProperty({ description: '클릭률 (CTR, %)', example: 3.0 })
  ctr: number;
}

export class AdvertiserStatsResponseDto {
  @ApiProperty({ type: [AdDailyStatDto], description: '일별 광고 통계 목록' })
  stats: AdDailyStatDto[];
}

export class AdvertiserStatsQueryDto {
  @ApiPropertyOptional({
    description: '시작 날짜 (YYYY-MM-DD, 기본: 7일 전)',
    example: '2026-04-01',
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: '종료 날짜 (YYYY-MM-DD, 기본: 오늘)',
    example: '2026-04-10',
  })
  endDate?: string;
}
