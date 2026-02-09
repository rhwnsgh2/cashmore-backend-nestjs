import { ApiProperty } from '@nestjs/swagger';

export class UseLotteryRequestDto {
  @ApiProperty({
    description: '사용할 복권 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  lotteryId: string;
}

export class UseLotteryResponseDto {
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
