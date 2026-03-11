import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InvitationService } from './invitation.service';
import { StepEventResponseDto } from './dto/step-event-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Invitation')
@Controller('invitation_step_event')
export class InvitationStepEventController {
  constructor(private invitationService: InvitationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '초대 단계별 이벤트 현황 조회',
    description:
      '초대한 사용자 수, 수령한 단계별 보상, 총 획득 포인트를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '단계별 이벤트 현황',
    type: StepEventResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getStepEvent(
    @CurrentUser('userId') userId: string,
  ): Promise<StepEventResponseDto> {
    return this.invitationService.getStepEvent(userId);
  }
}
