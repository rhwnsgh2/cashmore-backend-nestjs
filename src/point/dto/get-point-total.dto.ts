import { ApiProperty } from '@nestjs/swagger';

export class PointTotalResponseDto {
  @ApiProperty({
    description: '총 보유 포인트',
    example: 15000,
  })
  totalPoint: number;

  @ApiProperty({
    description: '이번 달 말 소멸 예정 포인트',
    example: 500,
  })
  expiringPoints: number;

  @ApiProperty({
    description: '포인트 소멸 예정일 (해당 월 말일)',
    example: '2026-01-31',
  })
  expiringDate: string;

  @ApiProperty({
    description: '오늘 적립 포인트',
    example: 50,
  })
  todayPoint: number;

  @ApiProperty({
    description: '지난주 적립 포인트 (월~일 기준)',
    example: 500,
  })
  lastWeekPoint: number;

  @ApiProperty({
    description: '이번주 적립 포인트 (월~일 기준)',
    example: 300,
  })
  weeklyPoint: number;
}
