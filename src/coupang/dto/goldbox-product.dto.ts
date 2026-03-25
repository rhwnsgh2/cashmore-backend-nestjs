import { ApiProperty } from '@nestjs/swagger';

export class GoldBoxProductDto {
  @ApiProperty({ description: '상품 ID', example: '12345' })
  id: string;

  @ApiProperty({ description: '상품명', example: '삼성 갤럭시 버즈' })
  name: string;

  @ApiProperty({ description: '할인율 텍스트', example: '30%' })
  discount: string;

  @ApiProperty({ description: '가격 텍스트', example: '89,000원' })
  price: string;

  @ApiProperty({ description: '상품 이미지 URL' })
  image: string;

  @ApiProperty({ description: '상품 링크 URL' })
  link: string;
}

export class GoldBoxResponseDto {
  @ApiProperty({ type: [GoldBoxProductDto], description: '골드박스 상품 목록' })
  products: GoldBoxProductDto[];
}
