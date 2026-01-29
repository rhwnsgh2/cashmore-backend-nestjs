import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueLotteryRequestDto {
  @ApiProperty({
    description: '복권 타입',
    example: 'MAX_500',
    enum: ['STANDARD_5', 'MAX_100', 'MAX_500', 'MAX_1000'],
  })
  lotteryType: string;

  @ApiPropertyOptional({
    description: '발급 사유',
    example: 'ad_reward_lottery_13:00',
  })
  reason?: string;
}

export class IssueLotteryResponseDto {
  @ApiProperty({ description: '복권 ID' })
  id: string;

  @ApiProperty({ description: '사용자 ID' })
  userId: string;

  @ApiProperty({ description: '복권 타입 ID' })
  lotteryTypeId: string;

  @ApiProperty({ description: '복권 상태', example: 'ISSUED' })
  status: string;

  @ApiProperty({ description: '발급 일시' })
  issuedAt: string;

  @ApiProperty({ description: '만료 일시' })
  expiresAt: string;

  @ApiProperty({ description: '당첨 금액', example: 5 })
  rewardAmount: number;
}

export class IssueAndUseLotteryResponseDto {
  @ApiProperty({ description: '복권 ID' })
  id: string;

  @ApiProperty({ description: '사용자 ID' })
  userId: string;

  @ApiProperty({ description: '당첨 금액', example: 5 })
  rewardAmount: number;

  @ApiProperty({ description: '복권 상태', example: 'USED' })
  status: string;

  @ApiProperty({ description: '사용 일시' })
  usedAt: string;
}
