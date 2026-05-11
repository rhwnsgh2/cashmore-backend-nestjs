import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CurationDto {
  @ApiProperty({ description: '차감 포인트', example: 1500, minimum: 0 })
  @IsInt()
  @Min(0)
  point_price!: number;

  @ApiProperty({ description: '노출 여부', example: true })
  @IsBoolean()
  is_visible!: boolean;

  @ApiPropertyOptional({
    description:
      '노출용 상품명 (override). 빈 문자열이거나 미전송 시 smartcon_goods.goods_name 그대로 사용',
    example: '아메리카노 ICE',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  display_name?: string | null;
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

  @ApiProperty({ nullable: true })
  display_name!: string | null;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}

export class ReorderDto {
  @ApiProperty({
    description:
      '정렬 대상 브랜드명 (smartcon_goods.brand_name과 정확히 일치). 이 브랜드 상품의 display_order만 갱신됨.',
    example: '이마트24',
  })
  @IsString()
  brand!: string;

  @ApiProperty({
    description:
      '해당 브랜드 안에서 노출 순서대로 정렬된 goods_id 배열. 배열에 없는 같은 브랜드 상품은 display_order=NULL로 초기화되어 뒤로 빠짐.',
    example: ['0000128425', '0000129119'],
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  goodsIds!: string[];
}

export class CatalogItemDto {
  @ApiProperty({
    nullable: true,
    description: 'gifticon_products.id (큐레이션 안 된 상품은 null)',
  })
  id!: number | null;

  @ApiProperty()
  goods_id!: string;

  @ApiProperty({ nullable: true })
  brand_name!: string | null;

  @ApiProperty({
    nullable: true,
    description: '스마트콘 원본 상품명 (smartcon_goods.goods_name)',
  })
  goods_name!: string | null;

  @ApiProperty({
    nullable: true,
    description: '어드민이 override한 노출용 이름 (NULL이면 goods_name 사용)',
  })
  display_name!: string | null;

  @ApiProperty({
    nullable: true,
    description: '노출 순서 (낮을수록 위, NULL은 뒤로)',
  })
  display_order!: number | null;

  @ApiProperty({ nullable: true })
  msg!: string | null;

  @ApiProperty({ nullable: true })
  smartcon_price!: number | null;

  @ApiProperty({ nullable: true })
  smartcon_disc_price!: number | null;

  @ApiProperty({
    nullable: true,
    description: 'CloudFront 캐시 URL 우선, 없으면 원본 URL',
  })
  img_url!: string | null;

  @ApiProperty({ nullable: true })
  point_price!: number | null;

  @ApiProperty()
  is_visible!: boolean;

  @ApiProperty({ description: 'smartcon_goods.is_active (단종 여부 표시용)' })
  is_active!: boolean;
}
