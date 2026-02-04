import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import type { RewardLevelV2 } from '../constants/reward-config-v2';

// Status Response DTO
class RewardLevelV2Dto {
  @ApiProperty({ description: '필요 걸음 수', example: 5000 })
  required_steps: number;

  @ApiProperty({ description: '레벨 라벨', example: '5천걸음' })
  label: string;

  @ApiProperty({
    description: '복권 타입',
    example: 'MAX_500',
    enum: ['MAX_100', 'MAX_500', 'MAX_1000'],
  })
  lottery_type: string;

  @ApiProperty({
    description: '광고 타입',
    example: 'rewarded',
    enum: ['rewarded', 'interstitial'],
  })
  ad_type: string;
}

export class StepRewardsStatusV2ResponseDto {
  @ApiProperty({
    description: '오늘 이미 수령한 required_steps 목록',
    type: [Number],
    example: [0, 1000, 2000],
  })
  claimed_required_steps: number[];

  @ApiProperty({
    description: '보상 레벨 설정 (v2)',
    type: [RewardLevelV2Dto],
  })
  reward_config: readonly RewardLevelV2[];
}

// Claim Request DTO
export class ClaimStepRewardV2RequestDto {
  @ApiProperty({
    description: '현재 걸음 수',
    example: 5000,
  })
  @IsInt()
  @Min(0)
  step_count: number;

  @ApiProperty({
    description: '수령할 보상의 required_steps',
    example: 5000,
  })
  @IsInt()
  @Min(0)
  required_steps: number;
}

// Claim Response DTO
export class ClaimStepRewardV2ResponseDto {
  @ApiProperty({ description: '수령 성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '발급된 복권 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  lottery_id: string;
}
