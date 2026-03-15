import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class MatchRequestDto {
  @ApiProperty({ description: 'OS 이름', example: 'iOS' })
  @IsString()
  @IsNotEmpty()
  os: string;

  @ApiProperty({ description: 'OS 버전', example: '18.3.2' })
  @IsString()
  @IsNotEmpty()
  osVersion: string;

  @ApiPropertyOptional({ description: '화면 너비 (px)' })
  @IsOptional()
  @IsNumber()
  screenWidth?: number;

  @ApiPropertyOptional({ description: '화면 높이 (px)' })
  @IsOptional()
  @IsNumber()
  screenHeight?: number;

  @ApiPropertyOptional({
    description: '디바이스 모델 (e.g., "Pixel 7", "iPhone15,2")',
  })
  @IsOptional()
  @IsString()
  model?: string;
}

export class MatchResponseDto {
  @ApiProperty({ description: '매칭 여부' })
  matched: boolean;

  @ApiPropertyOptional({
    description: '매칭된 파라미터',
    example: { code: 'ABC', receiptId: '123' },
  })
  params?: Record<string, string>;

  @ApiPropertyOptional({ description: '매칭된 경로', example: '/invite' })
  path?: string;
}
