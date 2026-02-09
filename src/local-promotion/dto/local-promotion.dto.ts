import { ApiProperty } from '@nestjs/swagger';

export class PromotionInfoDto {
  @ApiProperty({ description: '가맹점 ID', example: 1309 })
  location_id: number;

  @ApiProperty({ description: '프로모션 시작일 (ISO 8601)' })
  promotion_start_date: string;

  @ApiProperty({ description: '프로모션 종료일 (ISO 8601)' })
  promotion_end_date: string;

  @ApiProperty({ description: '가맹점 이름', example: '별미뼈다귀 본점' })
  title: string;

  @ApiProperty({ description: '가맹점 설명', example: '24시간 운영하는 맛집' })
  description: string;

  @ApiProperty({ description: '캐시백 비율 (%)', example: 15 })
  cashback_rate: number;

  @ApiProperty({ description: '가맹점 이미지 URL' })
  image_url: string;

  @ApiProperty({ description: '짧은 설명', example: '계양구 뼈요리 맛집' })
  short_description: string;

  @ApiProperty({ description: '상세 설명 제목' })
  description_title: string;

  @ApiProperty({
    description: '상세 설명 문단 배열',
    type: [String],
  })
  description_detail: string[];

  @ApiProperty({
    description: '특징 태그 배열',
    type: [String],
    example: ['단체 이용 가능', '주차 가능', '24시 영업'],
  })
  features: string[];
}

export class LocalPromotionResponseDto {
  @ApiProperty({
    description: '프로모션 목록',
    type: [PromotionInfoDto],
  })
  promotions: PromotionInfoDto[];
}
