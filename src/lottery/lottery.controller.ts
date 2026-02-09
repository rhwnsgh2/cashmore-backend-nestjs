import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LotteryService } from './lottery.service';
import { LotteryResponseDto } from './dto/get-my-lotteries.dto';
import {
  IssueLotteryRequestDto,
  IssueLotteryResponseDto,
  ShowAdAndClaimRequestDto,
  ShowAdAndClaimResponseDto,
} from './dto/issue-lottery.dto';
import {
  UseLotteryRequestDto,
  UseLotteryResponseDto,
} from './dto/use-lottery.dto';
import { MaxRewardUserDto } from './dto/max-reward-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { LotteryType } from './interfaces/lottery-repository.interface';

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

  @Post('issue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '복권 발급',
    description: '복권을 발급합니다.',
  })
  @ApiResponse({ status: 201, type: IssueLotteryResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async issueLottery(
    @CurrentUser('userId') userId: string,
    @Body() dto: IssueLotteryRequestDto,
  ): Promise<IssueLotteryResponseDto> {
    const lottery = await this.lotteryService.issueLottery(
      userId,
      dto.lotteryType as LotteryType,
      dto.reason,
    );
    return {
      id: lottery.id,
      userId: lottery.user_id,
      lotteryTypeId: lottery.lottery_type_id,
      status: lottery.status,
      issuedAt: lottery.issued_at,
      expiresAt: lottery.expires_at,
      rewardAmount: lottery.reward_amount,
    };
  }

  @Post('showAdAndClaim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '광고 시청 후 복권 발급 및 즉시 사용',
    description:
      '광고를 시청하고 복권을 발급하여 즉시 사용합니다. ad_lottery_slots에 기록됩니다.',
  })
  @ApiResponse({ status: 201, type: ShowAdAndClaimResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async showAdAndClaim(
    @CurrentUser('userId') userId: string,
    @Body() dto: ShowAdAndClaimRequestDto,
  ): Promise<ShowAdAndClaimResponseDto> {
    const { success, lottery } = await this.lotteryService.showAdAndClaim(
      userId,
      dto.adId,
      dto.slotTime,
    );
    return {
      success,
      lottery: {
        id: lottery.id,
        userId: lottery.userId,
        rewardAmount: lottery.rewardAmount,
        status: lottery.status,
        usedAt: lottery.usedAt,
      },
    };
  }

  @Post('use')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '복권 사용',
    description:
      '발급된 복권을 사용하여 포인트를 지급받습니다. ISSUED 상태의 복권만 사용 가능합니다.',
  })
  @ApiResponse({ status: 201, type: UseLotteryResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async useLottery(
    @CurrentUser('userId') userId: string,
    @Body() dto: UseLotteryRequestDto,
  ): Promise<UseLotteryResponseDto> {
    return this.lotteryService.useLottery(userId, dto.lotteryId);
  }

  @Get('max-reward-users')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '최대 당첨금 수령자 목록',
    description:
      '각 복권 타입별 최대 당첨금(100원, 500원, 1000원)을 받은 사용자 목록을 조회합니다.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '조회할 최대 개수 (기본값: 10)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '최대 당첨자 목록',
    type: [MaxRewardUserDto],
  })
  async getMaxRewardUsers(
    @Query('limit') limit?: string,
  ): Promise<MaxRewardUserDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.lotteryService.getMaxRewardUsers(parsedLimit);
  }
}
