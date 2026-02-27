import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class GetAdsQueryDto {
  @ApiPropertyOptional({
    description:
      '광고식별자 (GAID/IDFA). 없으면 00000000-0000-0000-0000-000000000000 사용',
    example: 'ab4ade35-1c8a-4405-acda-10ca1ad1abe1',
  })
  @IsOptional()
  @IsString()
  ifa?: string;

  @ApiProperty({ description: '플랫폼', enum: ['A', 'I'] })
  @IsIn(['A', 'I'])
  platform: 'A' | 'I';

  @ApiPropertyOptional({
    description: '생년월일 (YYYY-MM-DD)',
    example: '1993-01-09',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthday?: string;

  @ApiPropertyOptional({ description: '성별', enum: ['M', 'F'] })
  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: string;

  @ApiPropertyOptional({ description: '통신사', example: 'kt' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ description: '디바이스명', example: 'SM-G928L' })
  @IsOptional()
  @IsString()
  device_name?: string;

  @ApiPropertyOptional({ description: 'User-Agent 문자열' })
  @IsOptional()
  @IsString()
  user_agent?: string;

  @ApiPropertyOptional({ description: '페이지네이션 커서' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
