import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StreakService } from './streak.service';
import { GetAllStreaksResponseDto } from './dto/get-all-streaks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Streak')
@Controller('streak')
export class StreakController {
  constructor(private streakService: StreakService) {}

  @Get('all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '전체 스트릭 조회',
    description: '사용자의 모든 영수증 제출 스트릭 기록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '스트릭 조회 성공',
    type: GetAllStreaksResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getAllStreaks(
    @CurrentUser('userId') userId: string,
  ): Promise<GetAllStreaksResponseDto> {
    const streaks = await this.streakService.getAllStreaks(userId);
    return { streaks };
  }
}
