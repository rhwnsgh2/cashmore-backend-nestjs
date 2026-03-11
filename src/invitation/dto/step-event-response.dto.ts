import { ApiProperty } from '@nestjs/swagger';
import type { InvitationStep } from '../constants/invitation-steps';

export class StepEventResponseDto {
  @ApiProperty({ description: '초대한 사용자 수', example: 5 })
  invitationCount: number;

  @ApiProperty({
    description: '수령한 단계별 보상 step_count 목록',
    example: [3, 5],
    type: [Number],
  })
  receivedRewards: number[];

  @ApiProperty({ description: '총 획득 포인트', example: 4500 })
  totalPoints: number;

  @ApiProperty({
    description: '단계별 보상 목록',
    example: [
      { count: 3, reward: '천원 받기', amount: 1000 },
      { count: 5, reward: '2천원 받기', amount: 2000 },
    ],
  })
  steps: InvitationStep[];

  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;
}
