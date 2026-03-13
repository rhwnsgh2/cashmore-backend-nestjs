import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteOnboardingResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: '지급된 포인트', example: 40 })
  pointAmount?: number;

  @ApiPropertyOptional({ description: '에러 메시지' })
  error?: string;
}
