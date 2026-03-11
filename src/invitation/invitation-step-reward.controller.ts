import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InvitationService } from './invitation.service';
import {
  StepRewardRequestDto,
  StepRewardResponseDto,
} from './dto/step-reward.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Invitation')
@Controller('invitation-step-reward')
export class InvitationStepRewardController {
  constructor(private invitationService: InvitationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '초대 단계별 보상 수령',
    description:
      '초대 수가 단계 조건을 충족하면 해당 단계의 보상을 수령합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '보상 수령 성공',
    type: StepRewardResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async claimStepReward(
    @CurrentUser('userId') userId: string,
    @Body() dto: StepRewardRequestDto,
  ): Promise<StepRewardResponseDto> {
    return this.invitationService.claimStepReward(userId, dto.stepCount);
  }
}
