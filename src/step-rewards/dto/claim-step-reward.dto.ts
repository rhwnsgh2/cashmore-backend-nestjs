import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, Min } from 'class-validator';
import type { ClaimType } from '../constants/reward-config';

export class ClaimStepRewardRequestDto {
  @ApiProperty({ description: '현재 걸음 수', example: 5000 })
  @IsNumber()
  @Min(0)
  step_count: number;

  @ApiProperty({ description: '수령할 레벨 (1-6)', example: 3 })
  @IsInt()
  @Min(1)
  claim_level: number;

  @ApiProperty({
    description: '복권 타입 (long: MAX_500, short: MAX_100)',
    enum: ['long', 'short'],
    example: 'long',
  })
  @IsIn(['long', 'short'])
  type: ClaimType;
}

export class ClaimStepRewardResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '발급된 복권 ID', example: 'uuid-string' })
  lottery_id: string;
}
