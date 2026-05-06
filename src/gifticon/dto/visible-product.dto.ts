import { ApiProperty } from '@nestjs/swagger';

export class VisibleProductDto {
  @ApiProperty({ description: 'gifticon_products.id' })
  id!: number;

  @ApiProperty({ description: '스마트콘 상품 ID' })
  goods_id!: string;

  @ApiProperty({
    nullable: true,
    description: '브랜드명 (프론트에서 그룹핑용)',
  })
  brand_name!: string | null;

  @ApiProperty({ nullable: true })
  goods_name!: string | null;

  @ApiProperty({ nullable: true, description: '사용 안내' })
  msg!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'CloudFront 캐시 URL 우선, 없으면 원본 URL',
  })
  img_url!: string | null;

  @ApiProperty({ description: '차감 포인트' })
  point_price!: number;

  @ApiProperty({
    nullable: true,
    description: '스마트콘 정가 (원). UI에서 할인 표시용',
    example: 1800,
  })
  original_price!: number | null;
}
