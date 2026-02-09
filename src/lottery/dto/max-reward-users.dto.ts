import { ApiProperty } from '@nestjs/swagger';

export class MaxRewardUserDto {
  @ApiProperty({ description: '마스킹된 닉네임', example: '홍길****' })
  maskedNickname: string;

  @ApiProperty({ description: '당첨 금액', example: 500 })
  amount: number;

  @ApiProperty({
    description: '복권 타입',
    enum: ['MAX_100', 'MAX_500', 'MAX_1000'],
    example: 'MAX_500',
  })
  lotteryType: string;

  @ApiProperty({ description: '사용 시각 (ISO 8601)' })
  usedAt: string;
}
