import { ApiProperty } from '@nestjs/swagger';
import type { InvitationStep } from '../constants/invitation-steps';

export class PartnerStepEventActiveResponseDto {
  @ApiProperty({ example: true })
  isActive: true;

  @ApiProperty({ description: '파트너 프로그램 ID', example: 42 })
  programId: number;

  @ApiProperty({
    description: '프로그램 시작 시각',
    example: '2026-04-22T00:00:00.000Z',
  })
  startsAt: string;

  @ApiProperty({
    description: '프로그램 종료 시각',
    example: '2026-04-29T23:59:59.999Z',
  })
  endsAt: string;

  @ApiProperty({
    description: '프로그램 기간 내 초대한 사용자 수',
    example: 5,
  })
  invitationCount: number;

  @ApiProperty({
    description: '파트너 프로그램 기간 동안 초대 1건당 지급 포인트',
    example: 500,
  })
  pointsPerInvitation: number;

  @ApiProperty({
    description: '이 프로그램에서 수령한 스텝 count 목록',
    example: [3],
    type: [Number],
  })
  receivedRewards: number[];

  @ApiProperty({
    description: '이 프로그램에서 번 포인트 합계',
    example: 3500,
  })
  pointsEarned: number;

  @ApiProperty({ description: '파트너 전용 스텝 목록' })
  steps: InvitationStep[];

  @ApiProperty({
    description: '역대 누적 초대 수 (이벤트/기간 무관)',
    example: 20,
  })
  totalInvitationCount: number;

  @ApiProperty({
    description:
      '역대 초대로 받은 포인트 총합 (INVITE_REWARD + INVITE_STEP_REWARD)',
    example: 12000,
  })
  totalInvitationPoints: number;
}

export class PartnerStepEventInactiveResponseDto {
  @ApiProperty({ example: false })
  isActive: false;
}

export type PartnerStepEventResponseDto =
  | PartnerStepEventActiveResponseDto
  | PartnerStepEventInactiveResponseDto;
