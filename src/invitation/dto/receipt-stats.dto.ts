import { ApiProperty } from '@nestjs/swagger';

export class ReceiptStatsResponseDto {
  @ApiProperty({ description: '해당 영수증으로 초대된 친구 수', example: 3 })
  friendCount: number;

  @ApiProperty({
    description: '초대 보상 포인트 합계 (300P * friendCount)',
    example: 900,
  })
  inviteBonusPoint: number;

  @ApiProperty({
    description: '함께 영수증 보너스 포인트 합계 (20P * friendCount)',
    example: 60,
  })
  togetherReceiptBonusPoint: number;

  @ApiProperty({
    description: '총 보너스 포인트 (inviteBonusPoint + togetherReceiptBonusPoint)',
    example: 960,
  })
  totalBonusPoint: number;
}
