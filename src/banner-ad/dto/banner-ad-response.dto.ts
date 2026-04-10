import { ApiProperty } from '@nestjs/swagger';

export class BannerAdDto {
  @ApiProperty({ description: '배너 광고 ID', example: 1 })
  id: number;

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

  @ApiProperty({ description: '배너 위치', example: 'main' })
  placement: string;
}
