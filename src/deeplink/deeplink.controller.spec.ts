import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DeeplinkController } from './deeplink.controller';
import { DeeplinkService } from './deeplink.service';
import { DEEPLINK_REPOSITORY } from './interfaces/deeplink-repository.interface';
import { StubDeeplinkRepository } from './repositories/stub-deeplink.repository';
import { SlackService } from '../slack/slack.service';
import { InvitationService } from '../invitation/invitation.service';

describe('DeeplinkController', () => {
  let controller: DeeplinkController;
  let repository: StubDeeplinkRepository;
  let mockInvitationService: Record<string, ReturnType<typeof vi.fn>>;

  const IOS_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1';

  const mockRequest = (ip: string) =>
    ({
      ip,
    }) as any;

  beforeEach(async () => {
    repository = new StubDeeplinkRepository();
    mockInvitationService = {
      isReceiptExpired: vi.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeeplinkController],
      providers: [
        DeeplinkService,
        { provide: DEEPLINK_REPOSITORY, useValue: repository },
        {
          provide: SlackService,
          useValue: {
            reportDeeplinkClick: vi.fn().mockResolvedValue(undefined),
            reportDeeplinkMatch: vi.fn().mockResolvedValue(undefined),
            reportDeeplinkMatchAttempt: vi.fn().mockResolvedValue(undefined),
            reportDeeplinkMatchMiss: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: InvitationService,
          useValue: mockInvitationService,
        },
      ],
    }).compile();

    controller = module.get<DeeplinkController>(DeeplinkController);
  });

  describe('POST /deeplinks/click', () => {
    it('클릭 기록을 저장하고 결과를 반환한다', async () => {
      const result = await controller.click(
        {
          userAgent: IOS_UA,
          params: { code: 'ABC' },
          path: '/invite',
        },
        mockRequest('192.168.1.100'),
      );

      expect(result).toEqual({ recorded: true });
      expect(repository.getAll().size).toBe(1);
    });
  });

  describe('POST /deeplinks/match', () => {
    it('저장된 시그널과 매칭하여 결과를 반환한다', async () => {
      // 먼저 클릭 저장
      await controller.click(
        {
          userAgent: IOS_UA,
          params: { code: 'ABC' },
          path: '/invite',
        },
        mockRequest('192.168.1.100'),
      );

      // 매칭 시도
      const result = await controller.match(
        { os: 'iOS', osVersion: '18.3' },
        mockRequest('192.168.1.100'),
      );

      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ code: 'ABC' });
      expect(result.path).toBe('/invite');
    });

    it('매칭되지 않으면 matched: false를 반환한다', async () => {
      const result = await controller.match(
        { os: 'iOS', osVersion: '18.3' },
        mockRequest('192.168.1.100'),
      );

      expect(result).toEqual({ matched: false });
    });

    it('추가 시그널을 포함하여 매칭한다', async () => {
      await controller.click(
        {
          userAgent: IOS_UA,
          params: { code: 'ABC' },
          path: '/invite',
          screenWidth: 390,
          screenHeight: 844,
        },
        mockRequest('192.168.1.100'),
      );

      const result = await controller.match(
        {
          os: 'iOS',
          osVersion: '18.3',
          screenWidth: 390,
          screenHeight: 844,
        },
        mockRequest('192.168.1.100'),
      );

      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ code: 'ABC' });
    });

    it('receiptId가 있고 유효하면 receiptValid: true를 반환한다', async () => {
      mockInvitationService.isReceiptExpired.mockResolvedValue(false);

      await controller.click(
        {
          userAgent: IOS_UA,
          params: { code: 'ABC', receiptId: '99' },
          path: '/invite',
        },
        mockRequest('192.168.1.100'),
      );

      const result = await controller.match(
        { os: 'iOS', osVersion: '18.3' },
        mockRequest('192.168.1.100'),
      );

      expect(result.matched).toBe(true);
      expect(result.receiptValid).toBe(true);
    });

    it('receiptId가 있고 만료되었으면 receiptValid: false를 반환한다', async () => {
      mockInvitationService.isReceiptExpired.mockResolvedValue(true);

      await controller.click(
        {
          userAgent: IOS_UA,
          params: { code: 'ABC', receiptId: '99' },
          path: '/invite',
        },
        mockRequest('192.168.1.100'),
      );

      const result = await controller.match(
        { os: 'iOS', osVersion: '18.3' },
        mockRequest('192.168.1.100'),
      );

      expect(result.matched).toBe(true);
      expect(result.receiptValid).toBe(false);
    });

    it('receiptId가 없으면 receiptValid를 포함하지 않는다', async () => {
      await controller.click(
        {
          userAgent: IOS_UA,
          params: { code: 'ABC' },
          path: '/invite',
        },
        mockRequest('192.168.1.100'),
      );

      const result = await controller.match(
        { os: 'iOS', osVersion: '18.3' },
        mockRequest('192.168.1.100'),
      );

      expect(result.matched).toBe(true);
      expect(result).not.toHaveProperty('receiptValid');
    });
  });
});
