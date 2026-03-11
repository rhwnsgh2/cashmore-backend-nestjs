import { ApiProperty } from '@nestjs/swagger';

export class CheckInResponseDto {
  @ApiProperty({
    description: '출석 체크 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '주간 개근 보너스 지급 여부',
    example: false,
  })
  weeklyBonusEarned: boolean;

  @ApiProperty({
    description: '실패 사유 (이미 출석한 경우)',
    example: 'Already attended today',
    required: false,
  })
  reason?: string;
}
