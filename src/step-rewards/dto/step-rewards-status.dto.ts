import { ApiProperty } from '@nestjs/swagger';
import type { RewardLevel } from '../constants/reward-config';

class RewardLevelDto {
  @ApiProperty({ description: '레벨', example: 1 })
  level: number;

  @ApiProperty({ description: '필요 걸음 수', example: 2000 })
  required_steps: number;

  @ApiProperty({ description: '레벨 라벨', example: '2천걸음' })
  label: string;
}

export class StepRewardsStatusResponseDto {
  @ApiProperty({
    description: '오늘 이미 수령한 레벨 목록',
    type: [Number],
    example: [1, 2],
  })
  claimed_levels: number[];

  @ApiProperty({
    description: '보상 레벨 설정',
    type: [RewardLevelDto],
  })
  reward_config: readonly RewardLevel[];
}
