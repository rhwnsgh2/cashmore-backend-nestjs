import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CoupangPartnersService } from './coupang-partners.service';
import { COUPANG_POSTBACK_REPOSITORY } from './interfaces/coupang-postback-repository.interface';
import { StubCoupangPostbackRepository } from './repositories/stub-coupang-postback.repository';
import type { CoupangPostbackRequestDto } from './dto/coupang-postback.dto';

describe('CoupangPartnersService', () => {
  let service: CoupangPartnersService;
  let stubRepo: StubCoupangPostbackRepository;

  const validDto: CoupangPostbackRequestDto = {
    afcode: 'AF000001',
    subid: 'cashmore',
    os: 'Android',
    adid: '12345-abcde-67890',
    click_id: 'click-001',
    order_time: '2026-03-27 12:00:00',
    order_price: 29900,
    purchase_cancel: 'purchase',
  };

  beforeEach(async () => {
    stubRepo = new StubCoupangPostbackRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoupangPartnersService,
        {
          provide: COUPANG_POSTBACK_REPOSITORY,
          useValue: stubRepo,
        },
      ],
    }).compile();

    service = module.get<CoupangPartnersService>(CoupangPartnersService);
  });

  describe('handlePostback', () => {
    it('정상 요청 시 result: S, message: OK를 반환한다', async () => {
      const result = await service.handlePostback(validDto);

      expect(result).toEqual({ result: 'S', message: 'OK' });
    });

    it('포스트백 데이터가 repository에 저장된다', async () => {
      await service.handlePostback(validDto);

      const records = stubRepo.getInsertedRecords();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        afcode: 'AF000001',
        subid: 'cashmore',
        os: 'Android',
        adid: '12345-abcde-67890',
        clickId: 'click-001',
        orderTime: '2026-03-27 12:00:00',
        orderPrice: 29900,
        purchaseCancel: 'purchase',
      });
    });

    it('rawData를 함께 전달하면 repository에 그대로 저장된다', async () => {
      const rawData = {
        ...validDto,
        extra_unknown_field: 'keep-me',
      };

      await service.handlePostback(validDto, rawData);

      const records = stubRepo.getInsertedRecords();
      expect(records[0].rawData).toEqual(rawData);
    });

    it('rawData를 생략하면 null로 저장된다', async () => {
      await service.handlePostback(validDto);

      const records = stubRepo.getInsertedRecords();
      expect(records[0].rawData).toBeNull();
    });

    it('cancel 포스트백도 정상 저장된다', async () => {
      const cancelDto: CoupangPostbackRequestDto = {
        ...validDto,
        purchase_cancel: 'cancel',
      };

      const result = await service.handlePostback(cancelDto);

      expect(result).toEqual({ result: 'S', message: 'OK' });
      const records = stubRepo.getInsertedRecords();
      expect(records[0].purchaseCancel).toBe('cancel');
    });

    it('click_id가 빈 문자열이어도 저장된다', async () => {
      const dto: CoupangPostbackRequestDto = {
        ...validDto,
        click_id: '',
      };

      await service.handlePostback(dto);

      const records = stubRepo.getInsertedRecords();
      expect(records[0].clickId).toBe('');
    });

    it('order_price가 0이어도 저장된다', async () => {
      const dto: CoupangPostbackRequestDto = {
        ...validDto,
        order_price: 0,
      };

      await service.handlePostback(dto);

      const records = stubRepo.getInsertedRecords();
      expect(records[0].orderPrice).toBe(0);
    });

    it('여러 포스트백을 연속 수신하면 모두 저장된다', async () => {
      await service.handlePostback(validDto);
      await service.handlePostback({
        ...validDto,
        afcode: 'AF000002',
        order_price: 50000,
      });
      await service.handlePostback({
        ...validDto,
        afcode: 'AF000003',
        purchase_cancel: 'cancel',
      });

      const records = stubRepo.getInsertedRecords();
      expect(records).toHaveLength(3);
      expect(records[0].afcode).toBe('AF000001');
      expect(records[1].afcode).toBe('AF000002');
      expect(records[2].afcode).toBe('AF000003');
    });

    it('iOS 포스트백도 정상 처리된다', async () => {
      const iosDto: CoupangPostbackRequestDto = {
        ...validDto,
        os: 'iOS',
        adid: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
      };

      const result = await service.handlePostback(iosDto);

      expect(result).toEqual({ result: 'S', message: 'OK' });
      const records = stubRepo.getInsertedRecords();
      expect(records[0].os).toBe('iOS');
      expect(records[0].adid).toBe('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE');
    });

    it('DTO의 snake_case 필드가 camelCase로 변환되어 저장된다', async () => {
      await service.handlePostback(validDto);

      const records = stubRepo.getInsertedRecords();
      expect(records[0]).toHaveProperty('clickId');
      expect(records[0]).toHaveProperty('orderTime');
      expect(records[0]).toHaveProperty('orderPrice');
      expect(records[0]).toHaveProperty('purchaseCancel');
    });

    it('repository 에러 시 예외가 전파된다', async () => {
      const failingRepo = new StubCoupangPostbackRepository();
      failingRepo.save = async () => {
        throw new Error('DB connection failed');
      };

      const failModule: TestingModule = await Test.createTestingModule({
        providers: [
          CoupangPartnersService,
          {
            provide: COUPANG_POSTBACK_REPOSITORY,
            useValue: failingRepo,
          },
        ],
      }).compile();

      const failService = failModule.get<CoupangPartnersService>(
        CoupangPartnersService,
      );

      await expect(failService.handlePostback(validDto)).rejects.toThrow(
        'DB connection failed',
      );
    });
  });
});
