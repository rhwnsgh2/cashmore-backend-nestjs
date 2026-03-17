import { ApiProperty } from '@nestjs/swagger';

export class GoldenLotteryAvailabilityDto {
  @ApiProperty({
    description: '황금 복권 발급 가능 여부',
    example: true,
  })
  isAvailable: boolean;

  @ApiProperty({
    description: '다음 발급 가능 시각 (발급 불가 시). null이면 지금 바로 가능',
    example: '2026-03-18T00:00:00+09:00',
    required: false,
    nullable: true,
  })
  nextAvailableAt: string | null;
}
