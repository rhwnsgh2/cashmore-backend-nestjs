import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { InviteCodeService } from './invite-code.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('InviteCode')
@Controller('can-input-invite-code')
export class InviteCodeController {
  constructor(private inviteCodeService: InviteCodeService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '초대 코드 입력 가능 여부 확인',
    description:
      '사용자가 초대 코드를 입력할 수 있는지 확인합니다. 디바이스 이벤트 참여 여부, 이미 초대받은 사용자인지, 24시간 내 가입 여부를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '초대 코드 입력 가능 여부 (true/false)',
    schema: { type: 'boolean' },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async canInputInviteCode(
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const canInput = await this.inviteCodeService.canInputInviteCode(userId);
    res.json(canInput);
  }
}
