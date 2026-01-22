import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
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
