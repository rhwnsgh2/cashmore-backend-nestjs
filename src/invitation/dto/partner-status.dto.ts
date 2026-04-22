import { ApiProperty } from '@nestjs/swagger';

export class PartnerStatusResponseDto {
  @ApiProperty({
    description: '현재 시각 기준 활성 파트너 프로그램이 있는지',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: '프로그램 시작 시각 (활성일 때만)',
    example: '2026-04-22T00:00:00.000Z',
    required: false,
  })
  startsAt?: string;

  @ApiProperty({
    description: '프로그램 종료 시각 (활성일 때만)',
    example: '2026-04-29T23:59:59.999Z',
    required: false,
  })
  endsAt?: string;
}
