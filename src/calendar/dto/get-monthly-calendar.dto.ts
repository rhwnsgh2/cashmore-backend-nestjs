import { ApiProperty } from '@nestjs/swagger';

export class DayActivityDto {
  @ApiProperty({
    description: '날짜',
    example: '2026-01-15',
  })
  date: string;

  @ApiProperty({
    description: '영수증 제출 개수',
    example: 2,
  })
  receipt_count: number;

  @ApiProperty({
    description: '획득 포인트',
    example: 500,
  })
  points: number;
}

export class GetMonthlyCalendarResponseDto {
  @ApiProperty({
    description: '조회 연월',
    example: '2026-01',
  })
  year_month: string;

  @ApiProperty({
    description: '해당 월 총 획득 포인트',
    example: 1500,
  })
  total_points: number;

  @ApiProperty({
    description: '활동이 있는 날짜별 정보',
    type: [DayActivityDto],
  })
  days: DayActivityDto[];
}
