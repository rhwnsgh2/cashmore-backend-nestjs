import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SlotTime } from '../interfaces/ad-lottery-slot-repository.interface';

export class SlotAvailabilityResponseDto {
  @ApiProperty({
    description: '현재 슬롯에서 광고 시청 가능 여부',
    example: true,
  })
  available: boolean;

  @ApiProperty({
    description: '현재 슬롯 시간',
    example: '09:00',
    enum: ['09:00', '13:00', '18:00', '22:00'],
  })
  currentSlot: SlotTime;

  @ApiPropertyOptional({
    description: '다음 슬롯 시간 (이미 시청한 경우에만 제공)',
    example: '13:00',
    enum: ['09:00', '13:00', '18:00', '22:00'],
  })
  nextSlot?: SlotTime;

  @ApiPropertyOptional({
    description: '다음 슬롯 시작 시간 (ISO 8601 형식, 이미 시청한 경우에만 제공)',
    example: '2026-01-23T04:00:00.000Z',
  })
  nextSlotTime?: string;

  @ApiProperty({
    description: '상태 메시지',
    example: '현재 09:00 슬롯을 시청할 수 있습니다',
  })
  message: string;
}
