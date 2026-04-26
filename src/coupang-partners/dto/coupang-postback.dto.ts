import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsIn } from 'class-validator';

export class CoupangPostbackRequestDto {
  @ApiProperty({ description: 'AF CODE', example: 'AF000000' })
  @IsString()
  afcode: string;

  @ApiProperty({ description: '매체명', example: 'cashmore' })
  @IsString()
  subid: string;

  @ApiProperty({ description: 'OS', example: 'Android' })
  @IsString()
  os: string;

  @ApiProperty({ description: 'GAID / IDFA', example: '00000-0000-0000' })
  @IsString()
  adid: string;

  @ApiProperty({ description: '쿠팡 클릭 추적 ID', example: '' })
  @IsString()
  click_id: string;

  @ApiProperty({ description: '구매 시간', example: '2026-03-27 12:00:00' })
  @IsString()
  order_time: string;

  @ApiProperty({ description: '주문 금액', example: 29900 })
  @IsNumber()
  order_price: number;

  @ApiProperty({
    description: 'purchase 또는 cancel',
    example: 'purchase',
    enum: ['purchase', 'cancel'],
  })
  @IsIn(['purchase', 'cancel'])
  purchase_cancel: string;

  @ApiProperty({ description: '주문 ID', example: 1234567890 })
  @IsNumber()
  order_id: number;
}

export class CoupangPostbackResponseDto {
  @ApiProperty({ description: 'S: success, E: error', example: 'S' })
  result: string;

  @ApiProperty({ description: '메시지', example: 'OK' })
  message: string;
}
