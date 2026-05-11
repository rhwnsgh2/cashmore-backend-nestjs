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
    enum: ['pending', 'sent', 'send_failed', 'refunded'],
  })
  send_status!: 'pending' | 'sent' | 'send_failed' | 'refunded';

  @ApiProperty({ nullable: true, description: '발급된 쿠폰 바코드 번호' })
  barcode_num!: string | null;

  @ApiProperty({ nullable: true, description: '유효기간 종료일 (YYYY-MM-DD)' })
  exp_date!: string | null;

  @ApiProperty({ nullable: true })
  result_code!: string | null;

  @ApiProperty({ nullable: true })
  result_msg!: string | null;
}
