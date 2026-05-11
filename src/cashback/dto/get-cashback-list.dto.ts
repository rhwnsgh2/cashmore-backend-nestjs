import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CashbackItemType } from '../interfaces/cashback-repository.interface';

export class CashbackItemDto {
  @ApiProperty({ description: '아이템 고유 ID', example: 'everyReceipt-123' })
  id: string;

  @ApiProperty({
    description: '캐시백 타입',
    example: 'everyReceipt',
    enum: [
      'claim',
      'dropCardCashback',
      'dropBrandCardCashback',
      'everyReceipt',
      'exchangePointToCash',
      'invitationReward',
      'invitedUserMissionReward_2',
      'invitedUserMissionReward_5',
      'inviteStepReward',
      'invitationRewardRandom',
      'coupangVisit',
      'lottery',
      'onboardingEvent',
      'affiliateCashback',
      'attendance',
      'attendanceWeeklyBonus',
      'stepReward',
      'pointExpiration',
      'dividend',
      'buzzvilReward',
      'invitationReceipt',
      'exchangePointToNaverpay',
      'gifticonExchange',
    ],
  })
  type: CashbackItemType;

  @ApiProperty({ description: '생성일시', example: '2026-03-24T10:00:00Z' })
  createdAt: string;

  @ApiProperty({ description: '금액 (포인트)', example: 100 })
  amount: number;

  @ApiPropertyOptional({
    description:
      '상태 — type별 의미 상이. gifticonExchange는 pending(승인 대기) / sent(발송 완료) / rejected(어드민 거절+환불).',
    example: 'done',
  })
  status?: string;

  @ApiPropertyOptional({
    description: '추가 데이터',
    example: { imageUrl: 'https://...' },
  })
  data?: Record<string, unknown>;
}

export class CashbackListResponseDto {
  @ApiProperty({ type: [CashbackItemDto], description: '캐시백 내역 목록' })
  items: CashbackItemDto[];

  @ApiProperty({
    description: '다음 페이지 커서 (null이면 마지막 페이지)',
    example: '2026-03-24T10:00:00Z',
    nullable: true,
  })
  nextCursor: string | null;
}
