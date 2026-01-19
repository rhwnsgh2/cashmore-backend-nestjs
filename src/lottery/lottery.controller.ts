import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LotteryService } from './lottery.service';
import { LotteryResponseDto } from './dto/get-my-lotteries.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Lottery')
@Controller('lottery')
export class LotteryController {
  constructor(private lotteryService: LotteryService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 복권 목록 조회',
    description:
      '사용자의 사용 가능한 복권 목록을 조회합니다. (ISSUED 상태, 만료되지 않은 복권)',
  })
  @ApiResponse({
    status: 200,
    description: '복권 목록 조회 성공',
    type: [LotteryResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getMyLotteries(
    @CurrentUser('userId') userId: string,
  ): Promise<LotteryResponseDto[]> {
    return this.lotteryService.getMyLotteries(userId);
  }
}
