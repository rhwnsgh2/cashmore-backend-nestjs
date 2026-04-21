import { ApiProperty } from '@nestjs/swagger';
import type { InvitationStep } from '../constants/invitation-steps';

export class ActiveProgramDto {
  @ApiProperty({ description: '파트너 프로그램 ID', example: 42 })
  id: number;

  @ApiProperty({
    description: '파트너 프로그램 시작 시각',
    example: '2026-04-20T00:00:00.000Z',
  })
  startsAt: string;

  @ApiProperty({
    description: '파트너 프로그램 종료 시각',
    example: '2026-04-27T23:59:59.999Z',
  })
  endsAt: string;
}

export class StepEventResponseDto {
  @ApiProperty({
    description:
      '현재 이벤트 기준 초대한 사용자 수. 파트너 프로그램 활성 시 프로그램 기간 내 카운트, 그 외엔 2025-09-11 이후 누적.',
    example: 5,
  })
  invitationCount: number;

  @ApiProperty({
    description: '유저가 초대한 전체 누적 사용자 수 (이벤트/기간 무관)',
    example: 20,
  })
  totalInvitationCount: number;

  @ApiProperty({
    description: '현재 적용 중인 파트너 프로그램. 없으면 null.',
    type: ActiveProgramDto,
    nullable: true,
    required: false,
  })
  activeProgram: ActiveProgramDto | null;

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
