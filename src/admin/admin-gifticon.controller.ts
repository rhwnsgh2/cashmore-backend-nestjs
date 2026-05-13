import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { GifticonService } from '../gifticon/gifticon.service';
import { CouponExchangeService } from '../gifticon/coupon-exchange.service';
import { PointService } from '../point/point.service';
import {
  CatalogItemDto,
  CurationDto,
  CurationResponseDto,
  ReorderDto,
} from '../gifticon/dto/curation.dto';
import {
  AdminExchangeItemDto,
  DailyStatsResponseDto,
  OrderResponseDto,
  RejectDto,
} from '../gifticon/dto/order.dto';
import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { CouponExchangeStatus } from '../gifticon/interfaces/coupon-exchange-repository.interface';

const VALID_STATUSES: CouponExchangeStatus[] = [
  'pending',
  'sent',
  'send_failed',
  'refunded',
  'rejected',
];

class DailyStatsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2024)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

@ApiTags('Admin - Gifticon')
@Controller('admin/gifticon')
export class AdminGifticonController {
  constructor(
    private readonly gifticonService: GifticonService,
    private readonly couponExchangeService: CouponExchangeService,
    private readonly pointService: PointService,
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
    summary: '브랜드별 노출 상품 순서 재배열',
    description:
      'body.brand에 해당하는 활성 상품만 scope. goodsIds 순서대로 display_order=1,2,3 부여. 같은 브랜드인데 goodsIds에 없는 상품은 NULL로 뒤로 빠짐. 다른 브랜드는 영향 없음.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: '재배열 완료' })
  async reorderProducts(
    @Headers('x-admin-api-key') apiKey: string,
    @Body() body: ReorderDto,
  ): Promise<{ success: boolean }> {
    this.validateApiKey(apiKey);
    await this.gifticonService.reorder(body.brand, body.goodsIds);
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

  @Get('exchanges')
  @ApiOperation({
    summary: '쿠폰 교환 목록 (status별)',
    description:
      'pending(승인 대기)은 오래된 순. status 미지정 시 pending. 최대 100건.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'sent', 'send_failed', 'refunded', 'rejected'],
  })
  @ApiResponse({ status: 200, type: [AdminExchangeItemDto] })
  async listExchanges(
    @Headers('x-admin-api-key') apiKey: string,
    @Query('status') status?: string,
  ): Promise<AdminExchangeItemDto[]> {
    this.validateApiKey(apiKey);
    const s = (status ?? 'pending') as CouponExchangeStatus;
    if (!VALID_STATUSES.includes(s)) {
      throw new UnauthorizedException(`invalid status: ${status}`);
    }
    const rows = await this.couponExchangeService.listByStatus(s);
    const pointMap = await this.pointService.getTotalPointsMap(
      rows.map((r) => r.user_id),
    );
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_total_point: pointMap.get(r.user_id) ?? 0,
      amount: r.amount,
      smartcon_goods_id: r.smartcon_goods_id,
      tr_id: r.tr_id,
      send_status: r.send_status,
      barcode_num: r.barcode_num,
      exp_date: r.exp_date,
      result_code: r.result_code,
      result_msg: r.result_msg,
      created_at: r.created_at,
    }));
  }

  @Get('stats/daily')
  @ApiOperation({
    summary: '월별 일일 발송 통계 (sent, KST)',
    description:
      'send_status=sent 행을 updated_at(승인된 시점) 기준으로 KST 일별 집계. 거래 없는 날도 count=0, amount=0으로 채워서 반환.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiQuery({ name: 'year', required: true, example: 2026 })
  @ApiQuery({ name: 'month', required: true, example: 5 })
  @ApiResponse({ status: 200, type: DailyStatsResponseDto })
  async getDailyStats(
    @Headers('x-admin-api-key') apiKey: string,
    @Query() query: DailyStatsQueryDto,
  ): Promise<DailyStatsResponseDto> {
    this.validateApiKey(apiKey);
    return this.couponExchangeService.getDailyStats(query.year, query.month);
  }

  @Post('approve/:id')
  @ApiOperation({
    summary: '쿠폰 교환 승인 (스마트콘 발송)',
    description:
      'pending만 받아 스마트콘 couponCreate 호출. 성공 → sent. 실패/네트워크 에러 → send_failed + 자동 환불.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiParam({ name: 'id', description: 'coupon_exchanges.id' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async approve(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrderResponseDto> {
    this.validateApiKey(apiKey);
    const exchange = await this.couponExchangeService.approve(id);
    return {
      id: exchange.id,
      send_status: exchange.send_status,
      barcode_num: exchange.barcode_num,
      exp_date: exchange.exp_date,
      result_code: exchange.result_code,
      result_msg: exchange.result_msg,
    };
  }

  @Post('reject/:id')
  @ApiOperation({
    summary: '쿠폰 교환 거절 (환불)',
    description:
      'pending만 받아 환불 + send_status=rejected. reason은 result_msg에 박제.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiParam({ name: 'id', description: 'coupon_exchanges.id' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async reject(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectDto,
  ): Promise<OrderResponseDto> {
    this.validateApiKey(apiKey);
    const exchange = await this.couponExchangeService.reject(id, body.reason);
    return {
      id: exchange.id,
      send_status: exchange.send_status,
      barcode_num: exchange.barcode_num,
      exp_date: exchange.exp_date,
      result_code: exchange.result_code,
      result_msg: exchange.result_msg,
    };
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
