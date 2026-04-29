import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CoupangVisitRequestDto {
  @ApiPropertyOptional({
    description: 'v2 여부 (true면 10P, false면 15P)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  v2?: boolean;
}

export class CoupangVisitResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiPropertyOptional({ description: '메시지' })
  message?: string;
}

export class CoupangVisitTodayResponseDto {
  @ApiProperty({
    description: '오늘(KST 자정 기준) 쿠팡 방문 보상 수령 여부',
    example: false,
  })
  hasVisitedToday: boolean;
}
