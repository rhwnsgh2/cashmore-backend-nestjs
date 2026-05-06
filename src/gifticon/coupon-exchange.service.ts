import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SmartconApiService } from '../smartcon/smartcon-api.service';
import {
  SMARTCON_GOODS_REPOSITORY,
  type ISmartconGoodsRepository,
} from '../smartcon/interfaces/smartcon-goods-repository.interface';
import { SMARTCON_RESULT_CODE_SUCCESS } from '../smartcon/dto/coupon-create.dto';
import {
  POINT_WRITE_SERVICE,
  type IPointWriteService,
} from '../point-write/point-write.interface';
import { PointService } from '../point/point.service';
import { UserInfoService } from '../user-info/user-info.service';
import {
  COUPON_EXCHANGE_REPOSITORY,
  type ICouponExchangeRepository,
  type CouponExchangeRow,
} from './interfaces/coupon-exchange-repository.interface';
import {
  COUPON_SEND_LOG_REPOSITORY,
  type ICouponSendLogRepository,
} from './interfaces/coupon-send-log-repository.interface';
import {
  GIFTICON_PRODUCT_REPOSITORY,
  type IGifticonProductRepository,
} from './interfaces/gifticon-product-repository.interface';
import { generateTrId } from './utils/tr-id';

const POINT_TYPE = 'GIFTICON_PURCHASE';

@Injectable()
export class CouponExchangeService {
  private readonly logger = new Logger(CouponExchangeService.name);

  constructor(
    private smartconApiService: SmartconApiService,
    @Inject(COUPON_EXCHANGE_REPOSITORY)
    private couponExchangeRepository: ICouponExchangeRepository,
    @Inject(COUPON_SEND_LOG_REPOSITORY)
    private couponSendLogRepository: ICouponSendLogRepository,
    @Inject(GIFTICON_PRODUCT_REPOSITORY)
    private gifticonProductRepository: IGifticonProductRepository,
    @Inject(SMARTCON_GOODS_REPOSITORY)
    private smartconGoodsRepository: ISmartconGoodsRepository,
    private userInfoService: UserInfoService,
    private pointService: PointService,
    @Inject(POINT_WRITE_SERVICE)
    private pointWriteService: IPointWriteService,
  ) {}

  async createOrder(input: {
    userId: string;
    goodsId: string;
  }): Promise<CouponExchangeRow> {
    const { userId, goodsId } = input;

    // 1. 사전 검증
    const product =
      await this.gifticonProductRepository.findByGoodsId(goodsId);
    if (!product || !product.is_visible) {
      throw new NotFoundException(
        `gifticon product not visible: ${goodsId}`,
      );
    }

    const goods = await this.smartconGoodsRepository.findById(goodsId);
    if (!goods || !goods.is_active) {
      throw new NotFoundException(`smartcon goods inactive: ${goodsId}`);
    }

    const phone = await this.userInfoService.getPhone(userId);
    if (!phone) {
      throw new BadRequestException('phone not registered');
    }

    const { totalPoint } = await this.pointService.getPointTotal(userId);
    if (totalPoint < product.point_price) {
      throw new BadRequestException('Insufficient points');
    }

    // 2. TR_ID 생성
    const trId = generateTrId();

    // 3. 차감
    const { id: pointActionId } = await this.pointWriteService.addPoint({
      userId,
      amount: -product.point_price,
      type: POINT_TYPE,
      additionalData: { goods_id: goodsId, tr_id: trId },
    });

    // 4. coupon_exchanges INSERT
    const exchange = await this.couponExchangeRepository.insert({
      user_id: userId,
      point_action_id: pointActionId,
      amount: product.point_price,
      smartcon_goods_id: goodsId,
      tr_id: trId,
    });

    // 5. send_logs INSERT
    await this.couponSendLogRepository.insert(exchange.id, phone);

    // 6. 스마트콘 호출
    try {
      const response = await this.smartconApiService.couponCreate({
        goodsId,
        receiverMobile: phone,
        trId,
      });

      if (response.RESULTCODE === SMARTCON_RESULT_CODE_SUCCESS) {
        return await this.couponExchangeRepository.updateSendResult(
          exchange.id,
          {
            send_status: 'sent',
            order_id: response.ORDER_ID ?? null,
            barcode_num: response.BARCODE_NUM ?? null,
            exp_date: response.EXP_DATE
              ? formatExpDate(response.EXP_DATE)
              : null,
            result_code: response.RESULTCODE,
            result_msg: response.RESULTMSG,
          },
        );
      }

      // 스마트콘 실패 응답 → 환불
      this.logger.warn(
        `couponCreate failed trId=${trId} resultCode=${response.RESULTCODE} msg=${response.RESULTMSG}`,
      );
      return await this.refundOnFailure({
        userId,
        amount: product.point_price,
        originalPointActionId: pointActionId,
        exchangeId: exchange.id,
        resultCode: response.RESULTCODE,
        resultMsg: response.RESULTMSG,
      });
    } catch (error) {
      // 네트워크 / timeout / 파싱 에러 → 환불
      this.logger.error(
        `couponCreate threw trId=${trId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return await this.refundOnFailure({
        userId,
        amount: product.point_price,
        originalPointActionId: pointActionId,
        exchangeId: exchange.id,
        resultCode: 'NETWORK_ERROR',
        resultMsg: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 어드민 수동 환불.
   * send_status='sent' 상태만 환불 가능 (pending/send_failed/refunded는 거부).
   */
  async refund(exchangeId: number): Promise<CouponExchangeRow> {
    const exchange =
      await this.couponExchangeRepository.findById(exchangeId);
    if (!exchange) {
      throw new NotFoundException(
        `coupon_exchanges not found: ${exchangeId}`,
      );
    }
    if (exchange.send_status !== 'sent') {
      throw new BadRequestException(
        `Cannot refund: status is "${exchange.send_status}"`,
      );
    }

    await this.pointWriteService.addPoint({
      userId: exchange.user_id,
      amount: exchange.amount, // 양수 복원
      type: POINT_TYPE,
      additionalData: {
        original_point_action_id: exchange.point_action_id,
        reason: 'admin_refund',
      },
    });

    return this.couponExchangeRepository.updateSendResult(exchangeId, {
      send_status: 'refunded',
    });
  }

  private async refundOnFailure(input: {
    userId: string;
    amount: number;
    originalPointActionId: number;
    exchangeId: number;
    resultCode: string;
    resultMsg: string;
  }): Promise<CouponExchangeRow> {
    await this.pointWriteService.addPoint({
      userId: input.userId,
      amount: input.amount, // 양수로 복원
      type: POINT_TYPE,
      additionalData: {
        original_point_action_id: input.originalPointActionId,
        reason: 'send_failed',
      },
    });
    return this.couponExchangeRepository.updateSendResult(input.exchangeId, {
      send_status: 'send_failed',
      result_code: input.resultCode,
      result_msg: input.resultMsg,
    });
  }
}

/** 'YYYYMMDD' → 'YYYY-MM-DD' (Postgres date 컬럼용). */
function formatExpDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
