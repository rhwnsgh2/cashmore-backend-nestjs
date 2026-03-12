import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InvitationService } from './invitation.service';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import {
  VerifyInvitationRequestDto,
  VerifyInvitationResponseDto,
} from './dto/verify-invitation.dto';
import {
  LottoProcessRequestDto,
  LottoProcessResponseDto,
} from './dto/lotto-process.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Invitation')
@Controller('invitation')
export class InvitationController {
  constructor(private invitationService: InvitationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '초대장 조회/생성',
    description:
      '사용자의 초대장을 조회합니다. 초대장이 없는 경우 자동으로 생성합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '초대장 조회/생성 성공',
    type: InvitationResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getInvitation(
    @CurrentUser('userId') userId: string,
  ): Promise<InvitationResponseDto> {
    return this.invitationService.getOrCreateInvitation(userId);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '초대 코드 검증',
    description:
      '초대 코드가 유효한지 검증합니다. 본인의 코드이거나 존재하지 않는 코드이면 실패를 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '초대 코드 검증 결과',
    type: VerifyInvitationResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async verifyInvitation(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyInvitationRequestDto,
  ): Promise<VerifyInvitationResponseDto> {
    return this.invitationService.verifyInvitationCode(
      userId,
      dto.invitationCode,
    );
  }

  @Post('lotto-process')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '초대 보상 처리 (로또)',
    description:
      '초대 코드를 입력하여 초대 보상을 처리합니다. 초대자에게 300P, 피초대자에게 랜덤 포인트를 지급합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '초대 보상 처리 결과',
    type: LottoProcessResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async lottoProcess(
    @CurrentUser('userId') userId: string,
    @Body() dto: LottoProcessRequestDto,
  ): Promise<LottoProcessResponseDto> {
    return await this.invitationService.processInvitationReward({
      invitedUserId: userId,
      inviteCode: dto.invitationCode,
    });
  }
}
