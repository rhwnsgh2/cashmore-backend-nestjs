import { ApiProperty } from '@nestjs/swagger';

export class AdvertiserBannerDto {
  @ApiProperty({ description: '배너 광고 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '배너 제목', example: '여름 프로모션 배너' })
  title: string;

  @ApiProperty({
    description: '배너 이미지 URL',
    example: 'https://cdn.example.com/banner.png',
  })
  imageUrl: string;

  @ApiProperty({
    description: '클릭 시 이동할 URL',
    example: 'https://link.example.com/promo',
  })
  clickUrl: string;

  @ApiProperty({ description: '활성 여부', example: true })
  isActive: boolean;

  @ApiProperty({
    description: '시작일',
    example: '2026-04-01',
    nullable: true,
  })
  startDate: string | null;

  @ApiProperty({
    description: '종료일',
    example: '2026-04-30',
    nullable: true,
  })
  endDate: string | null;
}

export class AdvertiserBannersResponseDto {
  @ApiProperty({
    type: [AdvertiserBannerDto],
    description: '광고주의 배너 목록',
  })
  banners: AdvertiserBannerDto[];
}
