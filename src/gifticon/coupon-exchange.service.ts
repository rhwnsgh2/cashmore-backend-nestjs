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
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const POINT_TYPE = 'GIFTICON_PURCHASE';
const KST = 'Asia/Seoul';

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
    idempotencyKey?: string;
  }): Promise<CouponExchangeRow> {
    const { userId, goodsId, idempotencyKey } = input;

    // 0. idempotency 사전 조회 — 같은 키로 이미 처리된 주문이면 즉시 반환
    if (idempotencyKey) {
      const existing =
        await this.couponExchangeRepository.findByIdempotencyKey(
          idempotencyKey,
        );
      if (existing) return existing;
    }

    // 1. 사전 검증
    const product = await this.gifticonProductRepository.findByGoodsId(goodsId);
    if (!product || !product.is_visible) {
      throw new NotFoundException(`gifticon product not visible: ${goodsId}`);
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

    // 3. coupon_exchanges INSERT 먼저 (idempotency_key UNIQUE로 race 차단)
    //    point_action_id는 일단 null, 차감 후 update.
    const exchange = await this.couponExchangeRepository.insertOrConflict({
      user_id: userId,
      point_action_id: null,
      amount: product.point_price,
      smartcon_goods_id: goodsId,
      tr_id: trId,
      idempotency_key: idempotencyKey ?? null,
    });

    // 동시 요청으로 UNIQUE 충돌이면 → 다른 요청이 만든 행 반환
    if (!exchange) {
      const existing = idempotencyKey
        ? await this.couponExchangeRepository.findByIdempotencyKey(
            idempotencyKey,
          )
        : null;
      if (existing) return existing;
      throw new BadRequestException('Duplicate order request');
    }

    // 4. 차감
    const { id: pointActionId } = await this.pointWriteService.addPoint({
      userId,
      amount: -product.point_price,
      type: POINT_TYPE,
      additionalData: { goods_id: goodsId, tr_id: trId },
    });

    // 5. 차감 결과를 coupon_exchanges에 연결
    await this.couponExchangeRepository.updatePointActionId(
      exchange.id,
      pointActionId,
    );

    // 6. 승인 대기 큐로 — 스마트콘 호출은 어드민 approve에서 수행.
    //    여기서는 'pending' 상태 그대로 반환.
    return (await this.couponExchangeRepository.findById(exchange.id))!;
  }

  /**
   * 어드민 승인 — pending만 받아 스마트콘 발송.
   * 성공 → 'sent' + send_logs INSERT.
   * 스마트콘 실패/네트워크 에러 → 'send_failed' + 환불.
   */
  async approve(exchangeId: number): Promise<CouponExchangeRow> {
    const exchange = await this.couponExchangeRepository.findById(exchangeId);
    if (!exchange) {
      throw new NotFoundException(`coupon_exchanges not found: ${exchangeId}`);
    }
    if (exchange.send_status !== 'pending') {
      throw new BadRequestException(
        `Cannot approve: status is "${exchange.send_status}"`,
      );
    }

    const product = await this.gifticonProductRepository.findByGoodsId(
      exchange.smartcon_goods_id,
    );
    const goods = await this.smartconGoodsRepository.findById(
      exchange.smartcon_goods_id,
    );
    const phone = await this.userInfoService.getPhone(exchange.user_id);
    if (!phone) {
      throw new BadRequestException('phone not registered');
    }
    const displayName =
      product?.display_name ?? goods?.goods_name ?? '기프티콘';

    await this.couponSendLogRepository.insert(exchange.id, phone);

    try {
      const response = await this.smartconApiService.couponCreate({
        goodsId: exchange.smartcon_goods_id,
        receiverMobile: phone,
        trId: exchange.tr_id,
        title: '캐시모어 기프티콘 도착',
        contents: `[캐시모어]\n${displayName} 기프티콘이 도착했어요.`,
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

      this.logger.warn(
        `couponCreate failed trId=${exchange.tr_id} resultCode=${response.RESULTCODE} msg=${response.RESULTMSG}`,
      );
      return await this.refundOnFailure({
        userId: exchange.user_id,
        amount: exchange.amount,
        originalPointActionId: exchange.point_action_id,
        exchangeId: exchange.id,
        resultCode: response.RESULTCODE,
        resultMsg: response.RESULTMSG,
      });
    } catch (error) {
      this.logger.error(
        `couponCreate threw trId=${exchange.tr_id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return await this.refundOnFailure({
        userId: exchange.user_id,
        amount: exchange.amount,
        originalPointActionId: exchange.point_action_id,
        exchangeId: exchange.id,
        resultCode: 'NETWORK_ERROR',
        resultMsg: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 어드민 거절 — pending만 받아 환불 후 'rejected'.
   * reason은 result_msg에 박제.
   */
  async reject(
    exchangeId: number,
    reason?: string,
  ): Promise<CouponExchangeRow> {
    const exchange = await this.couponExchangeRepository.findById(exchangeId);
    if (!exchange) {
      throw new NotFoundException(`coupon_exchanges not found: ${exchangeId}`);
    }
    if (exchange.send_status !== 'pending') {
      throw new BadRequestException(
        `Cannot reject: status is "${exchange.send_status}"`,
      );
    }

    await this.pointWriteService.addPoint({
      userId: exchange.user_id,
      amount: exchange.amount,
      type: POINT_TYPE,
      additionalData: {
        original_point_action_id: exchange.point_action_id,
        reason: 'admin_rejected',
      },
    });

    return this.couponExchangeRepository.updateSendResult(exchangeId, {
      send_status: 'rejected',
      result_code: 'ADMIN_REJECTED',
      result_msg: reason ?? null,
    });
  }

  async listByStatus(
    status: CouponExchangeRow['send_status'],
    page = 1,
    pageSize = 50,
  ): Promise<{
    items: CouponExchangeRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, Math.floor(page));
    const safeSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
    const offset = (safePage - 1) * safeSize;

    const [items, total] = await Promise.all([
      this.couponExchangeRepository.findByStatusPaged(status, offset, safeSize),
      this.couponExchangeRepository.countByStatus(status),
    ]);
    return {
      items,
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages: Math.max(1, Math.ceil(total / safeSize)),
    };
  }

  /**
   * 어드민 — 월별 일일 발송 통계 (sent만, updated_at 기준 KST).
   * 빈 날은 count=0, amount=0으로 채워서 반환.
   */
  async getDailyStats(
    year: number,
    month: number, // 1-12
  ): Promise<{
    items: Array<{ date: string; count: number; amount: number }>;
    totalCount: number;
    totalAmount: number;
  }> {
    if (month < 1 || month > 12) {
      throw new BadRequestException('month must be 1-12');
    }
    const startKst = dayjs.tz(`${year}-${pad2(month)}-01 00:00:00`, KST);
    const endKst = startKst.add(1, 'month'); // 다음 달 1일 00:00 KST (exclusive)

    const rows = await this.couponExchangeRepository.findSentByUpdatedAtRange(
      startKst.toISOString(),
      endKst.toISOString(),
    );

    const dayMap = new Map<string, { count: number; amount: number }>();
    for (const r of rows) {
      const dateKst = dayjs(r.updated_at).tz(KST).format('YYYY-MM-DD');
      const cur = dayMap.get(dateKst) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += r.amount;
      dayMap.set(dateKst, cur);
    }

    // 빈 날 채워서 정렬된 array
    const items: Array<{ date: string; count: number; amount: number }> = [];
    let cur = startKst;
    while (cur.isBefore(endKst)) {
      const d = cur.format('YYYY-MM-DD');
      const v = dayMap.get(d) ?? { count: 0, amount: 0 };
      items.push({ date: d, count: v.count, amount: v.amount });
      cur = cur.add(1, 'day');
    }

    const totalCount = items.reduce((s, i) => s + i.count, 0);
    const totalAmount = items.reduce((s, i) => s + i.amount, 0);
    return { items, totalCount, totalAmount };
  }

  /**
   * 어드민 수동 환불.
   * send_status='sent' 상태만 환불 가능 (pending/send_failed/refunded/rejected는 거부).
   */
  async refund(exchangeId: number): Promise<CouponExchangeRow> {
    const exchange = await this.couponExchangeRepository.findById(exchangeId);
    if (!exchange) {
      throw new NotFoundException(`coupon_exchanges not found: ${exchangeId}`);
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
    originalPointActionId: number | null;
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

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
