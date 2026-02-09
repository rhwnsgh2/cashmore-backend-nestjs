import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class NotificationSettingResponseDto {
  @ApiProperty({ description: '사용자 ID' })
  userId: string;

  @ApiProperty({ description: '알림 타입', example: 'AD_LOTTERY' })
  type: string;

  @ApiProperty({ description: '알림 활성화 여부' })
  enabled: boolean;
}

export class UpdateNotificationSettingDto {
  @ApiProperty({ description: '알림 활성화 여부' })
  @IsBoolean()
  enabled: boolean;
}

export class UpdateNotificationSettingResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '메시지' })
  message: string;
}
