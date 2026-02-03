import { Body, Controller, Get, Header, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StepRewardsService } from './step-rewards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ClaimStepRewardRequestDto,
  ClaimStepRewardResponseDto,
} from './dto/claim-step-reward.dto';
import { StepRewardsStatusResponseDto } from './dto/step-rewards-status.dto';

@ApiTags('StepRewards')
@Controller('step_rewards')
export class StepRewardsController {
  constructor(private stepRewardsService: StepRewardsService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '걸음 수 보상 상태 조회',
    description: '오늘 수령한 레벨 목록과 보상 설정을 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '걸음 수 보상 상태',
    type: StepRewardsStatusResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getStatus(
    @CurrentUser('userId') userId: string,
  ): Promise<StepRewardsStatusResponseDto> {
    return this.stepRewardsService.getStatus(userId);
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '걸음 수 보상 수령',
    description: '특정 레벨의 걸음 수 보상을 수령하고 복권을 발급받습니다.',
  })
  @ApiBody({ type: ClaimStepRewardRequestDto })
  @ApiResponse({
    status: 201,
    description: '보상 수령 성공',
    type: ClaimStepRewardResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiConflictResponse({ description: '이미 수령한 레벨' })
  async claimReward(
    @CurrentUser('userId') userId: string,
    @Body() dto: ClaimStepRewardRequestDto,
  ): Promise<ClaimStepRewardResponseDto> {
    return this.stepRewardsService.claimReward(
      userId,
      dto.step_count,
      dto.claim_level,
      dto.type,
    );
  }
}
