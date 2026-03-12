import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateUserRequestDto {
  @ApiPropertyOptional({ description: 'FCM 토큰', example: 'fcm-token-xxx' })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiProperty({ description: '마케팅 정보 수신 동의', example: false })
  @IsBoolean()
  marketingAgreement: boolean;

  @ApiProperty({ description: '온보딩 완료 여부', example: true })
  @IsBoolean()
  onboardingCompleted: boolean;

  @ApiPropertyOptional({
    description: '디바이스 ID',
    example: 'device-id-xxx',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class CreateUserResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: '생성된 사용자 ID' })
  userId?: string;

  @ApiPropertyOptional({ description: '생성된 닉네임' })
  nickname?: string;

  @ApiPropertyOptional({ description: '에러 메시지' })
  error?: string;
}
