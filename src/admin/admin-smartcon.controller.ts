import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SmartconService } from '../smartcon/smartcon.service';

@ApiTags('Admin - Smartcon')
@Controller('admin/smartcon')
export class AdminSmartconController {
  constructor(
    private readonly smartconService: SmartconService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sync')
  @ApiOperation({
    summary: '스마트콘 EVENT 상품 동기화',
    description:
      'GetEventGoods.sc 응답을 받아 smartcon_goods 테이블에 UPSERT. 응답에서 빠진 상품은 is_active=false 처리.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({
    status: 200,
    description:
      '동기화 결과 { fetched, upserted, deactivated, imagesCached, imagesFailed }',
  })
  async sync(@Headers('x-admin-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
    return this.smartconService.syncEventGoods();
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
