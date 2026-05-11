import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GifticonService } from './gifticon.service';
import { CouponExchangeService } from './coupon-exchange.service';
import { VisibleProductDto } from './dto/visible-product.dto';
import { CreateOrderDto, OrderResponseDto } from './dto/order.dto';

@ApiTags('Gifticon')
@Controller('gifticon')
export class GifticonController {
  constructor(
    private readonly gifticonService: GifticonService,
    private readonly couponExchangeService: CouponExchangeService,
  ) {}

  @Get('products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '노출 중인 기프티콘 상품 목록',
    description:
      '어드민이 노출 ON 한 활성 상품만 반환. 프론트에서 brand_name 기준으로 그룹핑.',
  })
  @ApiResponse({ status: 200, type: [VisibleProductDto] })
  async listProducts(): Promise<VisibleProductDto[]> {
    return this.gifticonService.listVisible();
  }

  @Post('order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '기프티콘 주문 (포인트 차감 + 스마트콘 발송)',
    description: '실패 시 자동 환불. 응답의 send_status로 성공/실패 판단.',
  })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async createOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const exchange = await this.couponExchangeService.createOrder({
      userId,
      goodsId: body.goodsId,
      idempotencyKey: body.idempotencyKey,
    });
    return {
      id: exchange.id,
      send_status: exchange.send_status,
      barcode_num: exchange.barcode_num,
      exp_date: exchange.exp_date,
      result_code: exchange.result_code,
      result_msg: exchange.result_msg,
    };
  }
}
