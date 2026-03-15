import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DeeplinkService } from './deeplink.service';
import { DEEPLINK_REPOSITORY } from './interfaces/deeplink-repository.interface';
import { StubDeeplinkRepository } from './repositories/stub-deeplink.repository';
import {
  generateFingerprintFromUA,
  generateFingerprintFromApp,
} from './utils/fingerprint';
import { SlackService } from '../slack/slack.service';

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

    it('params가 올바르게 저장된다', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC', receiptId: '123' },
        path: '/invite',
      });

      const stored = [...stubRepository.getAll().values()][0];
      expect(stored.params).toEqual({ code: 'ABC', receiptId: '123' });
      expect(stored.path).toBe('/invite');
      expect(stored.createdAt).toBeDefined();
    });
  });

  describe('matchFingerprint', () => {
    it('같은 fingerprint로 매칭 성공', async () => {
      // 웹에서 iOS UA로 클릭 저장
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      // 앱에서 같은 OS 정보로 매칭
      const result = await service.matchFingerprint(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });

      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ code: 'ABC' });
      expect(result.path).toBe('/invite');
    });

    it('매칭 후 데이터가 삭제된다 (재매칭 불가)', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      // 첫 번째 매칭 성공
      const first = await service.matchFingerprint(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });
      expect(first.matched).toBe(true);

      // 두 번째 매칭 실패 (이미 삭제됨)
      const second = await service.matchFingerprint(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });
      expect(second.matched).toBe(false);
    });

    it('fingerprint 불일치 시 matched: false 반환', async () => {
      await service.recordClick(TEST_IP, IOS_UA, {
        userAgent: IOS_UA,
        params: { code: 'ABC' },
        path: '/invite',
      });

      // 다른 IP로 매칭 시도
      const result = await service.matchFingerprint('10.0.0.1', {
        os: 'iOS',
        osVersion: '18.3',
      });

      expect(result.matched).toBe(false);
    });

    it('저장된 데이터 없으면 matched: false 반환', async () => {
      const result = await service.matchFingerprint(TEST_IP, {
        os: 'iOS',
        osVersion: '18.3',
      });

      expect(result.matched).toBe(false);
    });
  });
});

describe('fingerprint utils', () => {
  it('iOS UA에서 OS 정보를 정확히 파싱한다', () => {
    const hash = generateFingerprintFromUA(TEST_IP, IOS_UA);
    const expected = generateFingerprintFromApp(TEST_IP, 'iOS', '18.3');
    expect(hash).toBe(expected);
  });

  it('Android UA에서 OS 정보를 정확히 파싱한다', () => {
    const hash = generateFingerprintFromUA(TEST_IP, ANDROID_UA);
    const expected = generateFingerprintFromApp(TEST_IP, 'Android', '15');
    expect(hash).toBe(expected);
  });

  it('같은 입력 → 같은 해시', () => {
    const hash1 = generateFingerprintFromApp(TEST_IP, 'iOS', '18.3');
    const hash2 = generateFingerprintFromApp(TEST_IP, 'iOS', '18.3');
    expect(hash1).toBe(hash2);
  });

  it('다른 IP → 다른 해시', () => {
    const hash1 = generateFingerprintFromApp('192.168.1.1', 'iOS', '18.3');
    const hash2 = generateFingerprintFromApp('192.168.1.2', 'iOS', '18.3');
    expect(hash1).not.toBe(hash2);
  });

  it('웹 UA와 앱 정보가 같은 디바이스면 같은 해시를 생성한다', () => {
    // iOS 디바이스
    const webHash = generateFingerprintFromUA(TEST_IP, IOS_UA);
    const appHash = generateFingerprintFromApp(TEST_IP, 'iOS', '18.3');
    expect(webHash).toBe(appHash);

    // Android 디바이스
    const webHashAndroid = generateFingerprintFromUA(TEST_IP, ANDROID_UA);
    const appHashAndroid = generateFingerprintFromApp(TEST_IP, 'Android', '15');
    expect(webHashAndroid).toBe(appHashAndroid);
  });
});
