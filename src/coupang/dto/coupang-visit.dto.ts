import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CoupangVisitResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiPropertyOptional({ description: '메시지' })
  message?: string;
}

export class CoupangVisitTodayResponseDto {
  @ApiProperty({
    description: '오늘(KST 자정 기준) 쿠팡 방문 보상 수령 여부',
    example: false,
  })
  hasVisitedToday: boolean;
}

export class CoupangVisitStatusResponseDto {
  @ApiProperty({ description: '지금 방문 보상을 받을 수 있는지 여부' })
  canVisit: boolean;

  @ApiProperty({
    description: '마지막 방문 시각(ISO 8601). 방문 이력이 없으면 null',
    nullable: true,
    example: '2026-05-14T03:00:00.000Z',
  })
  lastVisitedAt: string | null;

  @ApiProperty({
    description: '다음 방문 가능 시각(ISO 8601). 방문 이력이 없으면 null',
    nullable: true,
    example: '2026-05-14T13:00:00.000Z',
  })
  nextAvailableAt: string | null;

  @ApiProperty({
    description: '다음 방문까지 남은 시간(초). 즉시 가능하면 0',
    example: 0,
  })
  remainingSeconds: number;
}
