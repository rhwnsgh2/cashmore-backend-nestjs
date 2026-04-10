import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CashbackService } from './cashback.service';
import { CashbackListResponseDto } from './dto/get-cashback-list.dto';
import { ReceivedCashbackResponseDto } from './dto/get-received-cashback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Cashback')
@Controller('cashback')
export class CashbackController {
  constructor(private cashbackService: CashbackService) {}

  @Get('received_cashback')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '총 수령 캐시백 조회',
    description:
      '완료된 claim 캐시백과 포인트 환급 금액을 합산하여 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '총 수령 캐시백 조회 성공',
    type: ReceivedCashbackResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getReceivedCashback(
    @CurrentUser('userId') userId: string,
  ): Promise<ReceivedCashbackResponseDto> {
    return this.cashbackService.getReceivedCashback(userId);
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '캐시백 내역 리스트 조회',
    description:
      '사용자의 캐시백 내역을 최신순으로 조회합니다. cursor 기반 페이지네이션을 지원합니다.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: '다음 페이지 커서 (created_at 기반)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '한 페이지 아이템 수 (기본값: 20)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '캐시백 리스트 조회 성공',
    type: CashbackListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패',
  })
  async getCashbackList(
    @CurrentUser('userId') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CashbackListResponseDto> {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.cashbackService.getCashbackList(
      userId,
      cursor || null,
      parsedLimit,
    );
  }
}
