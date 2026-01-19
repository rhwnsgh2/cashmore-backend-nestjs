import { ApiProperty } from '@nestjs/swagger';

export class LotteryResponseDto {
  @ApiProperty({
    description: '복권 ID',
    example: 'uuid-1234-5678',
  })
  id: string;

  @ApiProperty({
    description: '사용자 ID',
    example: 'user-uuid-1234',
  })
  userId: string;

  @ApiProperty({
    description: '복권 타입 ID',
    example: 'MAX_500',
    enum: ['MAX_100', 'MAX_500', 'MAX_1000'],
  })
  lotteryTypeId: string;

  @ApiProperty({
    description: '복권 타입',
    example: 'MAX_500',
    enum: ['MAX_100', 'MAX_500', 'MAX_1000'],
  })
  lotteryType: string;

  @ApiProperty({
    description: '복권 상태',
    example: 'ISSUED',
    enum: ['ISSUED', 'USED', 'EXPIRED'],
  })
  status: string;

  @ApiProperty({
    description: '발급일시',
    example: '2025-01-15T10:00:00Z',
  })
  issuedAt: string;

  @ApiProperty({
    description: '만료일시',
    example: '2025-01-22T10:00:00Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: '당첨 금액 (사용 전이면 0)',
    example: 0,
  })
  rewardAmount: number;

  @ApiProperty({
    description: '사용일시 (사용 전이면 undefined)',
    example: '2025-01-16T10:00:00Z',
    required: false,
  })
  usedAt?: string;
}
