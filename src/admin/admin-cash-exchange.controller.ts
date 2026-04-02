import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ExchangePointService } from '../exchange-point/exchange-point.service';

@ApiTags('Admin - CashExchange')
@Controller('admin/cash-exchanges')
export class AdminCashExchangeController {
  constructor(
    private readonly exchangePointService: ExchangePointService,
    private readonly configService: ConfigService,
  ) {}

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
