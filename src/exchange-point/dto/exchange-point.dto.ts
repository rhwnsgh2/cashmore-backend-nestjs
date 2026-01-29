import { ApiProperty } from '@nestjs/swagger';

export class ExchangePointRequestDto {
  @ApiProperty({
    description: '출금 금액 (최소 1000)',
    example: 5000,
  })
  amount: number;
}

export class ExchangePointResponseDto {
  @ApiProperty({ description: '출금 신청 ID' })
  id: number;

  @ApiProperty({ description: '생성 일시' })
  createdAt: string;

  @ApiProperty({ description: '출금 금액 (음수)' })
  amount: number;

  @ApiProperty({
    description: '상태',
    example: 'pending',
    enum: ['pending', 'done', 'rejected', 'cancelled'],
  })
  status: string;
}

export class ExchangePointSuccessDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '출금 신청 ID', required: false })
  id?: number;
}

export class CancelExchangePointRequestDto {
  @ApiProperty({ description: '취소할 출금 신청 ID' })
  id: number;
}
