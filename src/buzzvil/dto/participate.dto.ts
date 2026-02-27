import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class ParticipateRequestDto {
  @ApiProperty({ description: '캠페인 ID (광고 id 필드)', example: 10075328 })
  @IsNumber()
  campaign_id: number;

  @ApiProperty({
    description: '광고 할당 시 받은 payload',
    example: 'zh8qPfFDUycs3d...',
  })
  @IsString()
  payload: string;

  @ApiPropertyOptional({
    description: '광고식별자 (GAID/IDFA). 없으면 00000000-0000-0000-0000-000000000000 사용',
    example: 'ab4ade35-1c8a-4405-acda-10ca1ad1abe1',
  })
  @IsOptional()
  @IsString()
  ifa?: string;

  @ApiProperty({ description: '플랫폼', enum: ['A', 'I'] })
  @IsIn(['A', 'I'])
  platform: 'A' | 'I';

  @ApiPropertyOptional({ description: '디바이스명', example: 'SM-G928L' })
  @IsOptional()
  @IsString()
  device_name?: string;

  @ApiPropertyOptional({ description: '통신사', example: 'kt' })
  @IsOptional()
  @IsString()
  carrier?: string;
}
