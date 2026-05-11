import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { GifticonService } from '../gifticon/gifticon.service';
import { CouponExchangeService } from '../gifticon/coupon-exchange.service';
import {
  CatalogItemDto,
  CurationDto,
  CurationResponseDto,
  ReorderDto,
} from '../gifticon/dto/curation.dto';
import { OrderResponseDto } from '../gifticon/dto/order.dto';

@ApiTags('Admin - Gifticon')
@Controller('admin/gifticon')
export class AdminGifticonController {
  constructor(
    private readonly gifticonService: GifticonService,
    private readonly couponExchangeService: CouponExchangeService,
    private readonly configService: ConfigService,
  ) {}

  @Get('products')
  @ApiOperation({
    summary: '큐레이션 가능한 상품 목록 (smartcon_goods + 큐레이션 상태)',
    description:
      '단종된 상품도 포함되며 is_active 필드로 구분 가능. 큐레이션 안 된 상품은 id, point_price가 null.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, type: [CatalogItemDto] })
  async listCatalog(
    @Headers('x-admin-api-key') apiKey: string,
  ): Promise<CatalogItemDto[]> {
    this.validateApiKey(apiKey);
    return this.gifticonService.listCatalogForAdmin();
  }

  @Put('products/order')
  @ApiOperation({
    summary: '노출 상품 순서 재배열',
    description:
      '보낸 goodsIds 배열 순서대로 display_order=1,2,3... 부여. 배열에 없는 상품은 NULL로 초기화되어 뒤로 빠짐.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: '재배열 완료' })
  async reorderProducts(
    @Headers('x-admin-api-key') apiKey: string,
    @Body() body: ReorderDto,
  ): Promise<{ success: boolean }> {
    this.validateApiKey(apiKey);
    await this.gifticonService.reorder(body.goodsIds);
    return { success: true };
  }

  @Put('products/:goodsId')
  @ApiOperation({
    summary: '상품 큐레이션 (point_price + is_visible UPSERT)',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiParam({ name: 'goodsId', description: '스마트콘 GOODS_ID' })
  @ApiResponse({ status: 200, type: CurationResponseDto })
  async upsertCuration(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('goodsId') goodsId: string,
    @Body() body: CurationDto,
  ): Promise<CurationResponseDto> {
    this.validateApiKey(apiKey);
    return this.gifticonService.curate({
      goods_id: goodsId,
      point_price: body.point_price,
      is_visible: body.is_visible,
      display_name: body.display_name,
    });
  }

  @Post('refund/:id')
  @ApiOperation({
    summary: '쿠폰 발송 환불 (수동)',
    description:
      'send_status=sent 상태만 환불 가능. 환불 시 point_actions 복원 행 INSERT + send_status=refunded.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiParam({ name: 'id', description: 'coupon_exchanges.id' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async refund(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrderResponseDto> {
    this.validateApiKey(apiKey);
    const exchange = await this.couponExchangeService.refund(id);
    return {
      id: exchange.id,
      send_status: exchange.send_status,
      barcode_num: exchange.barcode_num,
      exp_date: exchange.exp_date,
      result_code: exchange.result_code,
      result_msg: exchange.result_msg,
    };
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
