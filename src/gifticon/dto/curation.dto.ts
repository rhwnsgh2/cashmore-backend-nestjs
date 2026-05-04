import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min } from 'class-validator';

export class CurationDto {
  @ApiProperty({ description: '차감 포인트', example: 1500, minimum: 0 })
  @IsInt()
  @Min(0)
  point_price!: number;

  @ApiProperty({ description: '노출 여부', example: true })
  @IsBoolean()
  is_visible!: boolean;
}

export class CurationResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  smartcon_goods_id!: string;

  @ApiProperty()
  point_price!: number;

  @ApiProperty()
  is_visible!: boolean;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}

export class CatalogItemDto {
  @ApiProperty({ nullable: true, description: 'gifticon_products.id (큐레이션 안 된 상품은 null)' })
  id!: number | null;

  @ApiProperty()
  goods_id!: string;

  @ApiProperty({ nullable: true })
  brand_name!: string | null;

  @ApiProperty({ nullable: true })
  goods_name!: string | null;

  @ApiProperty({ nullable: true })
  msg!: string | null;

  @ApiProperty({ nullable: true })
  smartcon_price!: number | null;

  @ApiProperty({ nullable: true })
  smartcon_disc_price!: number | null;

  @ApiProperty({ nullable: true, description: 'CloudFront 캐시 URL 우선, 없으면 원본 URL' })
  img_url!: string | null;

  @ApiProperty({ nullable: true })
  point_price!: number | null;

  @ApiProperty()
  is_visible!: boolean;

  @ApiProperty({ description: 'smartcon_goods.is_active (단종 여부 표시용)' })
  is_active!: boolean;
}
