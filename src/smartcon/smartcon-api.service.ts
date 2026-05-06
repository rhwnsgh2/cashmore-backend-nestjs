import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { XMLParser } from 'fast-xml-parser';
import * as iconv from 'iconv-lite';
import { SMARTCON_CONFIG } from './smartcon.constants';
import type { SmartconGetEventGoodsResponse } from './dto/smartcon-goods.dto';
import type {
  CouponCreateInput,
  CouponCreateResponse,
} from './dto/coupon-create.dto';

@Injectable()
export class SmartconApiService {
  private readonly logger = new Logger(SmartconApiService.name);
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // '00', '01012345678' 같은 leading zero 보존
  });

  constructor(private httpService: HttpService) {}

  async getEventGoods(
    eventId: string = SMARTCON_CONFIG.eventId,
  ): Promise<SmartconGetEventGoodsResponse> {
    const url = `${SMARTCON_CONFIG.apiBaseUrl}/goodsinfosvc/GetEventGoods.sc`;

    const response = await firstValueFrom(
      this.httpService.get<SmartconGetEventGoodsResponse>(url, {
        params: { event_id: eventId },
      }),
    );

    this.logger.log(
      `getEventGoods eventId=${eventId} count=${response.data.length}`,
    );
    return response.data;
  }

  /**
   * 4.1 쿠폰생성 — XML 응답(EUC-KR)을 받아 디코딩 후 객체로 변환.
   * EVENT_ID / USER_ID / ORDER_MOBILE / ORDER_CNT 는 SMARTCON_CONFIG에서 자동 주입.
   */
  async couponCreate(input: CouponCreateInput): Promise<CouponCreateResponse> {
    const url = `${SMARTCON_CONFIG.apiBaseUrl}/coupon/couponCreate.sc`;
    const params = {
      EVENT_ID: SMARTCON_CONFIG.eventId,
      GOODS_ID: input.goodsId,
      ORDER_CNT: '1',
      RECEIVERMOBILE: input.receiverMobile,
      ORDER_MOBILE: SMARTCON_CONFIG.orderMobile,
      USER_ID: SMARTCON_CONFIG.userId,
      TR_ID: input.trId,
    };

    const response = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(url, {
        params,
        responseType: 'arraybuffer',
      }),
    );

    const xml = iconv.decode(Buffer.from(response.data), 'euc-kr');
    const parsed = this.xmlParser.parse(xml) as {
      COUPONSEND?: CouponCreateResponse;
    };
    const body = parsed.COUPONSEND;
    if (!body) {
      throw new Error(`Smartcon couponCreate returned unexpected XML: ${xml}`);
    }

    const result: CouponCreateResponse = {
      RESULTCODE: String(body.RESULTCODE ?? ''),
      RESULTMSG: String(body.RESULTMSG ?? ''),
      RECEIVERMOBILE:
        body.RECEIVERMOBILE != null ? String(body.RECEIVERMOBILE) : undefined,
      BARCODE_NUM:
        body.BARCODE_NUM != null ? String(body.BARCODE_NUM) : undefined,
      ORDER_ID: body.ORDER_ID != null ? String(body.ORDER_ID) : undefined,
      USER_ID: body.USER_ID != null ? String(body.USER_ID) : undefined,
      TR_ID: body.TR_ID != null ? String(body.TR_ID) : undefined,
      EXP_DATE: body.EXP_DATE != null ? String(body.EXP_DATE) : undefined,
    };

    this.logger.log(
      `couponCreate trId=${input.trId} resultCode=${result.RESULTCODE}`,
    );
    return result;
  }
}
