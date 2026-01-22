import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceDto {
  @ApiProperty({
    description: '출석 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '사용자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: '출석 일자 (YYYY-MM-DD)',
    example: '2026-01-15',
  })
  attendanceDate: string;

  @ApiPropertyOptional({
    description: '출석 포인트',
    example: 100,
    nullable: true,
  })
  point: number | null;

  @ApiPropertyOptional({
    description: '광고 시청 보너스 포인트',
    example: 50,
    nullable: true,
  })
  adShowPoint: number | null;

  @ApiProperty({
    description: '생성 일시',
    example: '2026-01-15T10:30:00+09:00',
  })
  createdAt: string;
}
