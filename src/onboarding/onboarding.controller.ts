import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Onboarding')
@Controller()
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get('onboarding/event-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '온보딩 이벤트 참여 상태 조회',
    description:
      '사용자의 온보딩 이벤트 참여 여부와 오늘 진행 중인지를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '온보딩 이벤트 상태 조회 성공',
    type: Boolean,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getEventStatus(
    @CurrentUser('userId') userId: string,
  ): Promise<boolean> {
    return this.onboardingService.getEventStatus(userId);
  }

  @Get('onboarding-event-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '온보딩 이벤트 참여 상태 조회 (레거시)',
    description:
      '사용자의 온보딩 이벤트 참여 여부와 오늘 진행 중인지를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '온보딩 이벤트 상태 조회 성공',
    type: Boolean,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getEventStatusLegacy(
    @CurrentUser('userId') userId: string,
  ): Promise<boolean> {
    return this.onboardingService.getEventStatus(userId);
  }
}
