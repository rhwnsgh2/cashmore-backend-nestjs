import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserModalService } from './user-modal.service';
import { GetUserModalsResponseDto } from './dto/get-user-modals.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('User')
@Controller('user')
export class UserModalController {
  constructor(private userModalService: UserModalService) {}

  @Post('modals/:modalId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '모달 완료 처리',
    description: '특정 모달을 완료 상태로 변경합니다.',
  })
  @ApiParam({ name: 'modalId', description: '모달 ID', type: Number })
  @ApiResponse({ status: 200, description: '모달 완료 처리 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async completeModal(
    @CurrentUser('userId') userId: string,
    @Param('modalId', ParseIntPipe) modalId: number,
  ): Promise<{ success: boolean }> {
    return this.userModalService.completeModal(userId, modalId);
  }

  @Get('modals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '대기 중인 모달 목록 조회',
    description: '사용자에게 표시해야 할 대기 중인 모달 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '모달 목록 조회 성공',
    type: GetUserModalsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getPendingModals(
    @CurrentUser('userId') userId: string,
  ): Promise<GetUserModalsResponseDto> {
    return this.userModalService.getPendingModals(userId);
  }
}
