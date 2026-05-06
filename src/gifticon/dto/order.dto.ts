import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: '스마트콘 GOODS_ID', example: '0000128425' })
  @IsString()
  goodsId!: string;
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
