import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DeeplinkService } from './deeplink.service';
import { DEEPLINK_REPOSITORY } from './interfaces/deeplink-repository.interface';
import { StubDeeplinkRepository } from './repositories/stub-deeplink.repository';
import {
  parseUserAgent,
  normalizeVersion,
  scoreMatch,
} from './utils/fingerprint';
import { SlackService } from '../slack/slack.service';
import { InvitationService } from '../invitation/invitation.service';

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; SM-S928N Build/AP3A.241205.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36';

const TEST_IP = '192.168.1.100';

describe('DeeplinkService', () => {
  let service: DeeplinkService;
  let stubRepository: StubDeeplinkRepository;

  beforeEach(async () => {
    stubRepository = new StubDeeplinkRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeeplinkService,
        { provide: DEEPLINK_REPOSITORY, useValue: stubRepository },
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
          useValue: {
            isReceiptExpired: vi.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<DeeplinkService>(DeeplinkService);
  });

  describe('recordClick', () => {
    it('정상 클릭 기록 저장', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      expect(stubRepository.getAll().size).toBe(1);
    });

    it('params와 시그널이 올바르게 저장된다', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC', receiptId: '123' },
        path: '/invite',
        screenWidth: 390,
        screenHeight: 844,
        model: 'iPhone15,2',
      });

      const stored = stubRepository.getAll().get(TEST_IP);
      expect(stored).toBeDefined();
      expect(stored!.params).toEqual({ code: 'ABC', receiptId: '123' });
      expect(stored!.path).toBe('/invite');
      expect(stored!.os).toBe('iOS');
      expect(stored!.osVersion).toBe('18.3');
      expect(stored!.screenWidth).toBe(390);
      expect(stored!.screenHeight).toBe(844);
      expect(stored!.model).toBe('iPhone15,2');
      expect(stored!.createdAt).toBeDefined();
    });

    it('platformVersion이 있으면 UA 대신 사용한다', async () => {
      await service.recordClick(TEST_IP, ANDROID_UA, {
        userAgent: ANDROID_UA,
        params: { code: 'ABC' },
        path: '/invite',
        platformVersion: '15.0.0',
      });

      const stored = stubRepository.getAll().get(TEST_IP);
      expect(stored!.osVersion).toBe('15');
    });
  });

  describe('matchClick', () => {
    it('IP + OS 매칭 성공 (추가 시그널 없음, low confidence)', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      const result = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });

      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ code: 'ABC' });
      expect(result.path).toBe('/invite');
    });

    it('IP + OS + screen match → 성공', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
        screenWidth: 390,
        screenHeight: 844,
      });

      const result = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
        screenWidth: 390,
        screenHeight: 844,
      });

      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ code: 'ABC' });
    });

    it('IP + OS + version match → 성공', async () => {
      await service.recordClick(TEST_IP, ANDROID_UA, {
        userAgent: ANDROID_UA,
        params: { code: 'DEF' },
        path: '/share',
      });

      const result = await service.matchClick(TEST_IP, {
        os: 'Android',
        osVersion: '15',
      });

      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ code: 'DEF' });
    });

    it('IP + OS + all signals match → 성공 (high confidence)', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
        screenWidth: 390,
        screenHeight: 844,
        model: 'iPhone15,2',
      });

      const result = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
        screenWidth: 390,
        screenHeight: 844,
        model: 'iPhone15,2',
      });

      expect(result.matched).toBe(true);
    });

    it('Version mismatch but screen matches → 성공', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
        screenWidth: 390,
        screenHeight: 844,
      });

      const result = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '17.5',
        screenWidth: 390,
        screenHeight: 844,
      });

      expect(result.matched).toBe(true);
    });

    it('Screen mismatch but version matches → 성공', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
        screenWidth: 390,
        screenHeight: 844,
      });

      const result = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
        screenWidth: 428,
        screenHeight: 926,
      });

      expect(result.matched).toBe(true);
    });

    it('IP match but OS mismatch → 실패', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      const result = await service.matchClick(TEST_IP, {
        os: 'Android',
        osVersion: '15',
      });

      expect(result.matched).toBe(false);
    });

    it('매칭 후 데이터가 삭제된다 (재매칭 불가)', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      const first = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });
      expect(first.matched).toBe(true);

      const second = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });
      expect(second.matched).toBe(false);
    });

    it('다른 IP로 매칭 시도 시 matched: false', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      const result = await service.matchClick('10.0.0.1', {
        os: 'iOS',
        osVersion: '18.3',
      });

      expect(result.matched).toBe(false);
    });

    it('저장된 데이터 없으면 matched: false', async () => {
      const result = await service.matchClick(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });

      expect(result.matched).toBe(false);
    });
  });
});

describe('fingerprint utils', () => {
  describe('parseUserAgent', () => {
    it('iOS UA에서 OS 정보를 정확히 파싱한다', () => {
      const result = parseUserAgent(IOS_UA);
      expect(result.os).toBe('iOS');
      expect(result.osVersion).toBe('18.3');
    });

    it('Android UA에서 OS 정보를 정확히 파싱한다', () => {
      const result = parseUserAgent(ANDROID_UA);
      expect(result.os).toBe('Android');
      expect(result.osVersion).toBe('15');
    });

    it('알 수 없는 UA에서 unknown 반환', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0)');
      expect(result.os).toBe('unknown');
      expect(result.osVersion).toBe('unknown');
    });
  });

  describe('normalizeVersion', () => {
    it('Android 버전을 major만 남긴다', () => {
      expect(normalizeVersion('Android', '15.0.0')).toBe('15');
      expect(normalizeVersion('Android', '15')).toBe('15');
      expect(normalizeVersion('Android', '14.0')).toBe('14');
    });

    it('iOS 버전을 major.minor만 남긴다', () => {
      expect(normalizeVersion('iOS', '18.3.1')).toBe('18.3');
      expect(normalizeVersion('iOS', '18.3')).toBe('18.3');
      expect(normalizeVersion('iOS', '17.0.0')).toBe('17.0');
    });
  });

  describe('scoreMatch', () => {
    it('OS mismatch → 즉시 실패', () => {
      const result = scoreMatch(
        { os: 'iOS', osVersion: '18.3' },
        { os: 'Android', osVersion: '15' },
      );
      expect(result.matched).toBe(false);
      expect(result.details).toContain('OS mismatch');
    });

    it('OS match + no additional signals → low confidence 성공', () => {
      const result = scoreMatch(
        { os: 'iOS', osVersion: 'unknown' },
        { os: 'iOS', osVersion: 'unknown' },
      );
      // osVersion is 'unknown' on both sides, so version comparison is skipped
      // but actually normalizeVersion will still produce 'unknown', and the check is
      // for !== 'unknown', so this won't count as comparable
      // Wait: the click has os=iOS, osVersion=unknown.
      // normalizeVersion('iOS', 'unknown') = 'unknown' (split('.') = ['unknown'])
      // so clickVersion = 'unknown', matchVersion = 'unknown' → skipped.
      // No screen, no model → comparableSignals = 0 → low confidence match
      expect(result.matched).toBe(true);
      expect(result.score).toBe(0);
    });

    it('OS match + screen match → score 2', () => {
      const result = scoreMatch(
        { os: 'iOS', osVersion: '18.3', screenWidth: 390, screenHeight: 844 },
        { os: 'iOS', osVersion: '18.3', screenWidth: 390, screenHeight: 844 },
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    it('OS match + screen within ±2px tolerance → score 2', () => {
      const result = scoreMatch(
        { os: 'Android', osVersion: '16', screenWidth: 412, screenHeight: 892 },
        {
          os: 'Android',
          osVersion: '16',
          screenWidth: 411.43,
          screenHeight: 891.43,
        },
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    it('OS match + screen beyond ±2px tolerance → screen mismatch', () => {
      const result = scoreMatch(
        { os: 'Android', osVersion: '16', screenWidth: 412, screenHeight: 892 },
        {
          os: 'Android',
          osVersion: '16',
          screenWidth: 409,
          screenHeight: 892,
        },
      );
      // screen mismatch but version matches → still matched
      expect(result.matched).toBe(true);
      expect(result.score).toBe(1); // version only
    });

    it('OS match + version major match → score includes 1', () => {
      const result = scoreMatch(
        { os: 'iOS', osVersion: '18.3' },
        { os: 'iOS', osVersion: '18.5' },
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    it('OS match + model match → score includes 1', () => {
      const result = scoreMatch(
        { os: 'iOS', osVersion: '18.3', model: 'iPhone15,2' },
        { os: 'iOS', osVersion: '17.5', model: 'iPhone15,2' },
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    it('OS match + all signals match → high score', () => {
      const result = scoreMatch(
        {
          os: 'Android',
          osVersion: '15',
          screenWidth: 412,
          screenHeight: 915,
          model: 'Pixel 7',
        },
        {
          os: 'Android',
          osVersion: '15',
          screenWidth: 412,
          screenHeight: 915,
          model: 'Pixel 7',
        },
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(4); // screen(2) + version(1) + model(1)
    });

    it('OS match + all comparable signals mismatch → 실패', () => {
      const result = scoreMatch(
        {
          os: 'iOS',
          osVersion: '18.3',
          screenWidth: 390,
          screenHeight: 844,
          model: 'iPhone15,2',
        },
        {
          os: 'iOS',
          osVersion: '17.5',
          screenWidth: 428,
          screenHeight: 926,
          model: 'iPhone14,5',
        },
      );
      expect(result.matched).toBe(false);
    });

    it('case-insensitive OS comparison', () => {
      const result = scoreMatch(
        { os: 'ios', osVersion: '18.3' },
        { os: 'iOS', osVersion: '18.3' },
      );
      expect(result.matched).toBe(true);
    });

    it('click has signals but match does not → only version compared', () => {
      const result = scoreMatch(
        {
          os: 'iOS',
          osVersion: '18.3',
          screenWidth: 390,
          screenHeight: 844,
          model: 'iPhone15,2',
        },
        { os: 'iOS', osVersion: '18.3' },
      );
      // screen: click has, match doesn't → not comparable
      // model: click has, match doesn't → not comparable
      // version: both have, major matches → +1
      expect(result.matched).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(1);
    });
  });
});
