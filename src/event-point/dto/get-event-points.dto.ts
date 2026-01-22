import { ApiProperty } from '@nestjs/swagger';

export class EventPointDto {
  @ApiProperty({
    description: '포인트 액션 ID',
    example: 12345,
  })
  id: number;

  @ApiProperty({
    description: '이벤트 타입',
    enum: ['COUPANG_VISIT', 'ONBOARDING_EVENT', 'AFFILIATE', 'LOTTERY'],
    example: 'COUPANG_VISIT',
  })
  type: string;

  @ApiProperty({
    description: '생성 일시',
    example: '2026-01-15T10:30:00+09:00',
  })
  createdAt: string;

  @ApiProperty({
    description: '포인트 금액',
    example: 100,
  })
  point: number;
}
