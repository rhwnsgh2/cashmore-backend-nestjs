import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PostbackBodyDto {
  @ApiProperty({ description: 'auth_id (우리가 보낸 user_id)' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ description: '중복 방지용 고유 ID (최대 32자)' })
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @ApiProperty({ description: '지급할 포인트' })
  @IsString()
  @IsNotEmpty()
  point: string;

  @ApiProperty({ description: '광고 지면 ID' })
  @IsString()
  @IsNotEmpty()
  unit_id: string;

  @ApiPropertyOptional({ description: '광고 이름' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: '포인트 지급 시점 (UNIX Timestamp 초단위)' })
  @IsString()
  @IsNotEmpty()
  event_at: string;

  @ApiProperty({ description: '유저 액션 타입' })
  @IsString()
  @IsNotEmpty()
  action_type: string;

  @ApiProperty({ description: '광고 유형 (cpc, cpm, cpa 등)' })
  @IsString()
  @IsNotEmpty()
  revenue_type: string;

  @ApiProperty({ description: '캠페인 ID' })
  @IsString()
  @IsNotEmpty()
  campaign_id: string;

  @ApiPropertyOptional({ description: '추가 데이터 (JSON 문자열)' })
  @IsOptional()
  @IsString()
  extra?: string;

  @ApiPropertyOptional({ description: '암호화된 파라미터' })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({ description: 'HMAC Checksum' })
  @IsOptional()
  @IsString()
  c?: string;

  @ApiPropertyOptional({ description: '커스텀 파라미터 2' })
  @IsOptional()
  @IsString()
  custom2?: string;

  @ApiPropertyOptional({ description: '커스텀 파라미터 3' })
  @IsOptional()
  @IsString()
  custom3?: string;

  @ApiPropertyOptional({ description: '커스텀 파라미터 4' })
  @IsOptional()
  @IsString()
  custom4?: string;
}
