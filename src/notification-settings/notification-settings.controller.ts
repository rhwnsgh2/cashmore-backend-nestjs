import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationSettingsService } from './notification-settings.service';
import { EnableAllResponseDto } from './dto/enable-all-response.dto';
import {
  NotificationSettingResponseDto,
  UpdateNotificationSettingDto,
  UpdateNotificationSettingResponseDto,
} from './dto/notification-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('NotificationSettings')
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(
    private notificationSettingsService: NotificationSettingsService,
  ) {}

  @Get(':type')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '알림 설정 조회',
    description: '특정 알림 타입의 설정을 조회합니다.',
  })
  @ApiParam({ name: 'type', description: '알림 타입 (AD_LOTTERY)' })
  @ApiResponse({ status: 200, type: NotificationSettingResponseDto })
  @ApiBadRequestResponse({ description: '잘못된 알림 타입' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getNotificationSetting(
    @CurrentUser('userId') userId: string,
    @Param('type') type: string,
  ): Promise<NotificationSettingResponseDto> {
    return this.notificationSettingsService.getNotificationSetting(
      userId,
      type,
    );
  }

  @Put(':type')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '알림 설정 업데이트',
    description: '특정 알림 타입의 설정을 업데이트합니다.',
  })
  @ApiParam({ name: 'type', description: '알림 타입 (AD_LOTTERY)' })
  @ApiResponse({ status: 200, type: UpdateNotificationSettingResponseDto })
  @ApiBadRequestResponse({ description: '잘못된 알림 타입 또는 enabled 값' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async updateNotificationSetting(
    @CurrentUser('userId') userId: string,
    @Param('type') type: string,
    @Body() body: UpdateNotificationSettingDto,
  ): Promise<UpdateNotificationSettingResponseDto> {
    return await this.notificationSettingsService.updateNotificationSetting(
      userId,
      type,
      body.enabled,
    );
  }

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
