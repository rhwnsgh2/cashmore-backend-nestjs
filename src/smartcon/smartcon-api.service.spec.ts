import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import * as iconv from 'iconv-lite';
import { SmartconApiService } from './smartcon-api.service';
import { SMARTCON_CONFIG } from './smartcon.constants';
import type { SmartconGoodsResponseItem } from './dto/smartcon-goods.dto';

function eucKrXml(xml: string): ArrayBuffer {
  const buffer = iconv.encode(xml, 'euc-kr');
  // ArrayBuffer 반환 — Buffer는 ArrayBufferView이므로 .buffer로 ArrayBuffer 추출
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

describe('SmartconApiService', () => {
  let service: SmartconApiService;
  let httpGet: ReturnType<typeof vi.fn>;

  const sampleItem: SmartconGoodsResponseItem = {
    GOODS_ID: '0000128425',
    BRAND_NAME: '컴포즈커피',
    GOODS_NAME: '[컴포즈커피] 아메리카노(ICE)',
    MSG: '[이용안내] ...',
    PRICE: 1800,
    DISC_PRICE: 1710,
    DISC_RATE: 5,
    EXTRA_CHARGE: 0,
    IMG_URL: 'http://example/img.jpg',
    IMG_URL_HTTPS: 'https://example/img.jpg',
    GOODS_SALE_TYPE: 'BARCODE',
    GOODS_USE_TYPE: 'EXCHANGE',
    SC_LIMIT_DATE: 30,
    B2C_ITEM_NO: null,
  };

  beforeEach(async () => {
    httpGet = vi.fn().mockReturnValue(of({ data: [sampleItem] }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartconApiService,
        { provide: HttpService, useValue: { get: httpGet } },
      ],
    }).compile();

    service = module.get<SmartconApiService>(SmartconApiService);
  });

  describe('getEventGoods', () => {
    it('지정한 eventId로 GetEventGoods.sc를 호출한다', async () => {
      await service.getEventGoods('99999');

      expect(httpGet).toHaveBeenCalledOnce();
      const [url, config] = httpGet.mock.calls[0];
      expect(url).toBe(
        `${SMARTCON_CONFIG.apiBaseUrl}/goodsinfosvc/GetEventGoods.sc`,
      );
      expect(config.params).toEqual({ event_id: '99999' });
    });

    it('eventId 미지정 시 SMARTCON_CONFIG.eventId 기본값을 사용한다', async () => {
      await service.getEventGoods();
      const config = httpGet.mock.calls[0][1];
      expect(config.params.event_id).toBe(SMARTCON_CONFIG.eventId);
    });

    it('응답 배열을 그대로 반환한다', async () => {
      const result = await service.getEventGoods('64385');
      expect(result).toEqual([sampleItem]);
    });

    it('빈 응답이어도 배열을 반환한다', async () => {
      httpGet.mockReturnValueOnce(of({ data: [] }));
      const result = await service.getEventGoods('64385');
      expect(result).toEqual([]);
    });
  });

  describe('couponCreate', () => {
    const successXml = `<?xml version="1.0" encoding="EUC-KR" ?>
<COUPONSEND>
<RESULTCODE>00</RESULTCODE>
<RESULTMSG>처리완료</RESULTMSG>
<RECEIVERMOBILE>01012345678</RECEIVERMOBILE>
<BARCODE_NUM>1234567890123</BARCODE_NUM>
<ORDER_ID>SC20260506000001</ORDER_ID>
<USER_ID>bridgeworks</USER_ID>
<TR_ID>cashmore20260506100000001</TR_ID>
<EXP_DATE>20260605</EXP_DATE>
</COUPONSEND>`;

    const failXml = `<?xml version="1.0" encoding="EUC-KR" ?>
<COUPONSEND>
<RESULTCODE>99</RESULTCODE>
<RESULTMSG>잘못된 URL 입니다.</RESULTMSG>
</COUPONSEND>`;

    beforeEach(() => {
      httpGet.mockReturnValue(of({ data: eucKrXml(successXml) }));
    });

    it('GET /coupon/couponCreate.sc + arraybuffer responseType + 필수 파라미터', async () => {
      await service.couponCreate({
        goodsId: '0000128425',
        receiverMobile: '01012345678',
        trId: 'cashmore20260506100000001',
      });

      expect(httpGet).toHaveBeenCalledOnce();
      const [url, config] = httpGet.mock.calls[0];
      expect(url).toBe(`${SMARTCON_CONFIG.apiBaseUrl}/coupon/couponCreate.sc`);
      expect(config.responseType).toBe('arraybuffer');
      expect(config.params).toEqual({
        EVENT_ID: SMARTCON_CONFIG.eventId,
        GOODS_ID: '0000128425',
        ORDER_CNT: '1',
        RECEIVERMOBILE: '01012345678',
        ORDER_MOBILE: SMARTCON_CONFIG.orderMobile,
        USER_ID: SMARTCON_CONFIG.userId,
        TR_ID: 'cashmore20260506100000001',
      });
    });

    it('title/contents 옵션 전달 시 params에 포함', async () => {
      await service.couponCreate({
        goodsId: '0000128425',
        receiverMobile: '01012345678',
        trId: 'cashmore20260506100000010',
        title: '캐시모어 기프티콘 도착',
        contents: '[캐시모어]\n아메리카노 기프티콘이 도착했어요.',
      });
      const config = httpGet.mock.calls[0][1];
      expect(config.params.TITLE).toBe('캐시모어 기프티콘 도착');
      expect(config.params.CONTENTS).toBe(
        '[캐시모어]\n아메리카노 기프티콘이 도착했어요.',
      );
    });

    it('title/contents 미전송 시 params에 없음', async () => {
      await service.couponCreate({
        goodsId: '0000128425',
        receiverMobile: '01012345678',
        trId: 'cashmore20260506100000011',
      });
      const config = httpGet.mock.calls[0][1];
      expect(config.params.TITLE).toBeUndefined();
      expect(config.params.CONTENTS).toBeUndefined();
    });

    it('paramsSerializer가 EUC-KR percent encoding을 한다', async () => {
      await service.couponCreate({
        goodsId: 'A',
        receiverMobile: '01012345678',
        trId: 'cashmore20260506100000012',
        title: '가나',
      });
      const config = httpGet.mock.calls[0][1];
      const serialized = config.paramsSerializer({ TITLE: '가나' });
      // '가' = EUC-KR 0xB0 0xA1, '나' = 0xB3 0xAA
      expect(serialized).toBe('TITLE=%B0%A1%B3%AA');
    });

    it('paramsSerializer가 ASCII는 그대로 둔다', async () => {
      await service.couponCreate({
        goodsId: 'A',
        receiverMobile: '01012345678',
        trId: 'cashmore-test',
      });
      const config = httpGet.mock.calls[0][1];
      const serialized = config.paramsSerializer({ TR_ID: 'cashmore-test' });
      expect(serialized).toBe('TR_ID=cashmore-test');
    });

    it('성공 응답 → 모든 필드 파싱', async () => {
      const result = await service.couponCreate({
        goodsId: '0000128425',
        receiverMobile: '01012345678',
        trId: 'cashmore20260506100000001',
      });
      expect(result).toEqual({
        RESULTCODE: '00',
        RESULTMSG: '처리완료',
        RECEIVERMOBILE: '01012345678',
        BARCODE_NUM: '1234567890123',
        ORDER_ID: 'SC20260506000001',
        USER_ID: 'bridgeworks',
        TR_ID: 'cashmore20260506100000001',
        EXP_DATE: '20260605',
      });
    });

    it('실패 응답 → RESULTCODE/RESULTMSG만, 나머지 undefined', async () => {
      httpGet.mockReturnValueOnce(of({ data: eucKrXml(failXml) }));
      const result = await service.couponCreate({
        goodsId: '0000128425',
        receiverMobile: '01012345678',
        trId: 'cashmore20260506100000002',
      });
      expect(result).toEqual({
        RESULTCODE: '99',
        RESULTMSG: '잘못된 URL 입니다.',
        RECEIVERMOBILE: undefined,
        BARCODE_NUM: undefined,
        ORDER_ID: undefined,
        USER_ID: undefined,
        TR_ID: undefined,
        EXP_DATE: undefined,
      });
    });

    it('EUC-KR 한글이 정상 디코딩된다', async () => {
      const koreanXml = `<?xml version="1.0" encoding="EUC-KR" ?>
<COUPONSEND>
<RESULTCODE>52</RESULTCODE>
<RESULTMSG>수신자 휴대폰 번호 규격 오류</RESULTMSG>
</COUPONSEND>`;
      httpGet.mockReturnValueOnce(of({ data: eucKrXml(koreanXml) }));

      const result = await service.couponCreate({
        goodsId: 'X',
        receiverMobile: '02123',
        trId: 'cashmore20260506100000003',
      });
      expect(result.RESULTCODE).toBe('52');
      expect(result.RESULTMSG).toBe('수신자 휴대폰 번호 규격 오류');
    });

    it('숫자형 RESULTCODE도 string으로 정규화된다', async () => {
      // fast-xml-parser가 '00'을 number 0으로 파싱할 수 있음
      const numericXml = `<?xml version="1.0" encoding="EUC-KR" ?>
<COUPONSEND><RESULTCODE>0</RESULTCODE><RESULTMSG>ok</RESULTMSG></COUPONSEND>`;
      httpGet.mockReturnValueOnce(of({ data: eucKrXml(numericXml) }));
      const result = await service.couponCreate({
        goodsId: 'X',
        receiverMobile: '01012345678',
        trId: 'cashmore20260506100000004',
      });
      expect(typeof result.RESULTCODE).toBe('string');
    });

    it('COUPONSEND 루트가 없으면 에러', async () => {
      const badXml = `<?xml version="1.0" encoding="EUC-KR" ?>
<UNEXPECTED><a>1</a></UNEXPECTED>`;
      httpGet.mockReturnValueOnce(of({ data: eucKrXml(badXml) }));
      await expect(
        service.couponCreate({
          goodsId: 'X',
          receiverMobile: '01012345678',
          trId: 'cashmore20260506100000005',
        }),
      ).rejects.toThrow(/unexpected XML/);
    });
  });
});
