import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NaverPayService } from '../naver-pay/naver-pay.service';

@ApiTags('Admin - NaverPay')
@Controller('admin/naverpay')
export class AdminNaverPayController {
  constructor(
    private readonly naverPayService: NaverPayService,
    private readonly configService: ConfigService,
  ) {}

  @Get('exchanges')
  @ApiOperation({ summary: '전환 요청 목록 조회 (관리자)' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      '필터링할 상태 (pending, approved, completed, failed, cancelled, rejected)',
  })
  async getExchanges(
    @Headers('x-admin-api-key') apiKey: string,
    @Query('status') status?: string,
  ) {
    this.validateApiKey(apiKey);
    return this.naverPayService.getExchangesByStatus(status);
  }

  @Get('exchanges/daily-stats')
  @ApiOperation({
    summary: '완료 건 일자별 집계 (최근 7일, 관리자)',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  async getDailyStats(@Headers('x-admin-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
    return this.naverPayService.getCompletedDailyStats();
  }

  @Post('exchanges/:id/approve')
  @ApiOperation({ summary: '전환 요청 승인 → 다우 API 호출' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: '승인 및 적립 처리 결과' })
  async approveExchange(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id') id: string,
  ) {
    this.validateApiKey(apiKey);
    return this.naverPayService.approveExchange(id);
  }

  @Post('exchanges/:id/reject')
  @ApiOperation({ summary: '전환 요청 거절 → 포인트 복원' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: '거절 처리 결과' })
  async rejectExchange(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id') id: string,
  ) {
    this.validateApiKey(apiKey);
    return this.naverPayService.rejectExchange(id);
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
