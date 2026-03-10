import { ApiProperty } from '@nestjs/swagger';

export class NpsSurveyTargetResponseDto {
  @ApiProperty({
    description: 'NPS 서베이 대상 여부',
    example: true,
  })
  need: boolean;

  @ApiProperty({
    description: '사유',
    enum: ['already_submitted', 'exchange_today', 'target', 'not_target'],
    example: 'target',
  })
  reason: string;
}
