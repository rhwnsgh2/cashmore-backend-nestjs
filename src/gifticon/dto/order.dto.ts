import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: '스마트콘 GOODS_ID', example: '0000128425' })
  @IsString()
  goodsId!: string;

  @ApiPropertyOptional({
    description:
      '중복 요청 방지용 idempotency key. 같은 키로 재요청 시 기존 주문 그대로 반환.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class OrderResponseDto {
  @ApiProperty({ description: 'coupon_exchanges.id' })
  id!: number;

  @ApiProperty({
    enum: ['pending', 'sent', 'send_failed', 'refunded', 'rejected'],
  })
  send_status!: 'pending' | 'sent' | 'send_failed' | 'refunded' | 'rejected';

  @ApiProperty({ nullable: true, description: '발급된 쿠폰 바코드 번호' })
  barcode_num!: string | null;

  @ApiProperty({ nullable: true, description: '유효기간 종료일 (YYYY-MM-DD)' })
  exp_date!: string | null;

  @ApiProperty({ nullable: true })
  result_code!: string | null;

  @ApiProperty({ nullable: true })
  result_msg!: string | null;
}

export class DailyStatItemDto {
  @ApiProperty({ description: 'KST 일자 (YYYY-MM-DD)', example: '2026-05-01' })
  date!: string;

  @ApiProperty({ description: '해당 일 sent 건수', example: 3 })
  count!: number;

  @ApiProperty({
    description: '해당 일 sent 금액 합계 (포인트)',
    example: 4500,
  })
  amount!: number;
}

export class DailyStatsResponseDto {
  @ApiProperty({
    description: '월의 첫째 날부터 마지막 날까지 (빈 날은 count=0, amount=0)',
    type: [DailyStatItemDto],
  })
  items!: DailyStatItemDto[];

  @ApiProperty({ description: '월 전체 건수', example: 27 })
  totalCount!: number;

  @ApiProperty({ description: '월 전체 금액', example: 40500 })
  totalAmount!: number;
}

export class RejectDto {
  @ApiPropertyOptional({
    description: '거절 사유 (result_msg에 박제). 미전송 시 null.',
    example: '재고 소진',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class AdminExchangeListResponseDto {
  @ApiProperty({ type: () => [AdminExchangeItemDto] })
  items!: AdminExchangeItemDto[];

  @ApiProperty({ description: '필터에 매칭되는 총 행 수', example: 137 })
  total!: number;

  @ApiProperty({ description: '현재 페이지 (1-base)', example: 1 })
  page!: number;

  @ApiProperty({ description: '페이지 크기', example: 50 })
  pageSize!: number;

  @ApiProperty({ description: '전체 페이지 수', example: 3 })
  totalPages!: number;
}

export class AdminExchangeItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  user_id!: string;

  @ApiProperty({
    description:
      '해당 유저의 현재 보유 포인트 (이미 차감된 상태). 어드민이 승인/거절 판단에 참고.',
  })
  user_total_point!: number;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  smartcon_goods_id!: string;

  @ApiProperty()
  tr_id!: string;

  @ApiProperty({
    enum: ['pending', 'sent', 'send_failed', 'refunded', 'rejected'],
  })
  send_status!: 'pending' | 'sent' | 'send_failed' | 'refunded' | 'rejected';

  @ApiProperty({ nullable: true })
  barcode_num!: string | null;

  @ApiProperty({ nullable: true })
  exp_date!: string | null;

  @ApiProperty({ nullable: true })
  result_code!: string | null;

  @ApiProperty({ nullable: true })
  result_msg!: string | null;

  @ApiProperty()
  created_at!: string;
}
