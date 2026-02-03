import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationSettingsService } from './notification-settings.service';
import { EnableAllResponseDto } from './dto/enable-all-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('NotificationSettings')
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(
    private notificationSettingsService: NotificationSettingsService,
  ) {}

  @Post('enable-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '모든 알림 설정 활성화',
    description:
      '모든 알림 타입(AD_LOTTERY 등)을 활성화하고, 마케팅 정보 수신 동의를 true로 설정합니다.',
  })
  @ApiResponse({ status: 201, type: EnableAllResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async enableAll(
    @CurrentUser('userId') userId: string,
  ): Promise<EnableAllResponseDto> {
    return this.notificationSettingsService.enableAll(userId);
  }
}
