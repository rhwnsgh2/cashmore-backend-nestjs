import { ApiProperty } from '@nestjs/swagger';

export class StreakDto {
  @ApiProperty({
    description: '스트릭 시작 날짜',
    example: '2026-01-15',
  })
  start_date: string;

  @ApiProperty({
    description: '스트릭 종료 날짜',
    example: '2026-01-20',
  })
  end_date: string;

  @ApiProperty({
    description: '연속 일수',
    example: 6,
  })
  continuous_count: number;
}

export class GetAllStreaksResponseDto {
  @ApiProperty({
    description: '스트릭 목록 (최신순)',
    type: [StreakDto],
  })
  streaks: StreakDto[];
}
