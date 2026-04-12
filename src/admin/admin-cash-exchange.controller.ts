import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ExchangePointService } from '../exchange-point/exchange-point.service';

@ApiTags('Admin - CashExchange')
@Controller('admin/cash-exchanges')
export class AdminCashExchangeController {
  constructor(
    private readonly exchangePointService: ExchangePointService,
    private readonly configService: ConfigService,
  ) {}

  @Get('pending')
  @ApiOperation({ summary: '대기중 출금 요청 목록 + 계좌 정보 조회' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: 'pending 목록 및 계좌 정보' })
  async getPending(@Headers('x-admin-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
    return this.exchangePointService.getPendingWithAccountInfo();
  }

  @Get('search')
  @ApiOperation({ summary: '이메일로 출금 내역 검색 (어드민)' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiQuery({ name: 'email', required: true, description: '검색할 이메일 (3자 이상)' })
  @ApiResponse({ status: 200, description: '검색 결과' })
  async searchByEmail(
    @Headers('x-admin-api-key') apiKey: string,
    @Query('email') email: string,
  ) {
    this.validateApiKey(apiKey);
    return this.exchangePointService.searchByEmail(email);
  }

  @Post('approve')
  @ApiOperation({ summary: '출금 요청 일괄 승인' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: '승인 처리 결과' })
  async approveExchanges(
    @Headers('x-admin-api-key') apiKey: string,
    @Body() body: { ids: number[] },
  ) {
    this.validateApiKey(apiKey);
    return this.exchangePointService.approveExchanges(body.ids);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: '출금 요청 거절' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: '거절 처리 결과' })
  async rejectExchange(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    this.validateApiKey(apiKey);
    return this.exchangePointService.rejectExchange(Number(id), body.reason);
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
