import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BannerStatDto {
  @ApiProperty({ description: '배너 광고 ID', example: 1 })
  adId: number;

  @ApiProperty({ description: '배너 제목', example: '여름 프로모션 배너' })
  adTitle: string;

  @ApiProperty({ description: '노출 수', example: 5000 })
  impressions: number;

  @ApiProperty({ description: '클릭 수', example: 150 })
  clicks: number;

  @ApiProperty({ description: '클릭률 (CTR, %)', example: 3.0 })
  ctr: number;
}

export class BannerAdStatsSummaryResponseDto {
  @ApiProperty({ description: '총 노출 수', example: 10000 })
  totalImpressions: number;

  @ApiProperty({ description: '총 클릭 수', example: 300 })
  totalClicks: number;

  @ApiProperty({ description: '전체 CTR (%)', example: 3.0 })
  overallCtr: number;

  @ApiProperty({ type: [BannerStatDto], description: '배너별 통계' })
  banners: BannerStatDto[];
}

export class BannerAdStatsSummaryQueryDto {
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
