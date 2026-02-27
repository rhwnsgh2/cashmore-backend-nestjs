import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { BuzzvilApiService } from './buzzvil-api.service';
import { BUZZVIL_CONFIG } from './buzzvil.constants';

describe('BuzzvilApiService', () => {
  let service: BuzzvilApiService;
  let httpGet: ReturnType<typeof vi.fn>;
  let httpPost: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    httpGet = vi.fn().mockReturnValue(
      of({ data: { code: 200, ads: [], cursor: '' } }),
    );
    httpPost = vi.fn().mockReturnValue(
      of({ data: { code: 200, msg: 'ok', landing_url: 'https://example.com' } }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuzzvilApiService,
        {
          provide: HttpService,
          useValue: { get: httpGet, post: httpPost },
        },
      ],
    }).compile();

    service = module.get<BuzzvilApiService>(BuzzvilApiService);
  });

  describe('getAds', () => {
    const requiredParams = {
      userId: 'auth-123',
      clientIp: '1.2.3.4',
      ifa: 'ifa-uuid',
      platform: 'A' as const,
    };

    it('필수 파라미터로 Buzzvil API를 호출한다', async () => {
      await service.getAds(requiredParams);

      expect(httpGet).toHaveBeenCalledOnce();
      const [url, config] = httpGet.mock.calls[0];
      expect(url).toContain('/api/s2s/ads');
      expect(config.params).toMatchObject({
        app_id: BUZZVIL_CONFIG.aos.appId,
        unit_id: BUZZVIL_CONFIG.aos.unitId,
        user_id: 'auth-123',
        client_ip: '1.2.3.4',
        ifa: 'ifa-uuid',
        platform: 'A',
        country: 'KR',
        target_fill: 5,
      });
    });

    it('iOS 플랫폼이면 iOS app_id/unit_id를 사용한다', async () => {
      await service.getAds({ ...requiredParams, platform: 'I' });

      const params = httpGet.mock.calls[0][1].params;
      expect(params.app_id).toBe(BUZZVIL_CONFIG.ios.appId);
      expect(params.unit_id).toBe(BUZZVIL_CONFIG.ios.unitId);
    });

    it('revenue_types가 JSON 배열 문자열로 전달된다', async () => {
      await service.getAds(requiredParams);

      const params = httpGet.mock.calls[0][1].params;
      const revenueTypes = JSON.parse(params.revenue_types);
      expect(revenueTypes).not.toContain('cpc');
      expect(revenueTypes).not.toContain('cpm');
      expect(revenueTypes).toContain('cpa');
      expect(revenueTypes).toContain('cps');
    });

    it('선택 파라미터가 없으면 포함하지 않는다', async () => {
      await service.getAds(requiredParams);

      const params = httpGet.mock.calls[0][1].params;
      expect(params).not.toHaveProperty('birthday');
      expect(params).not.toHaveProperty('gender');
      expect(params).not.toHaveProperty('carrier');
      expect(params).not.toHaveProperty('cursor');
    });

    it('선택 파라미터가 있으면 포함한다', async () => {
      await service.getAds({
        ...requiredParams,
        birthday: '1993-01-09',
        gender: 'M',
        carrier: 'kt',
        deviceName: 'SM-G928L',
        cursor: 'abc123',
      });

      const params = httpGet.mock.calls[0][1].params;
      expect(params.birthday).toBe('1993-01-09');
      expect(params.gender).toBe('M');
      expect(params.carrier).toBe('kt');
      expect(params.device_name).toBe('SM-G928L');
      expect(params.cursor).toBe('abc123');
    });

    it('Buzzvil 응답을 그대로 반환한다', async () => {
      const mockResponse = { code: 200, ads: [{ id: 1 }], cursor: 'next' };
      httpGet.mockReturnValue(of({ data: mockResponse }));

      const result = await service.getAds(requiredParams);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('participate', () => {
    const requiredParams = {
      userId: 'auth-123',
      clientIp: '1.2.3.4',
      ifa: 'ifa-uuid',
      platform: 'A' as const,
      campaignId: 10075328,
      payload: 'zh8qPfFDUycs3d',
    };

    it('x-www-form-urlencoded body와 커스텀 헤더로 호출한다', async () => {
      await service.participate(requiredParams);

      expect(httpPost).toHaveBeenCalledOnce();
      const [url, body, config] = httpPost.mock.calls[0];
      expect(url).toContain('/api/participate');
      expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(config.headers['Buzz-App-ID']).toBe(BUZZVIL_CONFIG.aos.appId);
      expect(config.headers['Buzz-Publisher-User-ID']).toBe('auth-123');
      expect(config.headers['Buzz-IFA']).toBe('ifa-uuid');
    });

    it('body에 필수 파라미터가 포함된다', async () => {
      await service.participate(requiredParams);

      const body = httpPost.mock.calls[0][1];
      const params = new URLSearchParams(body);
      expect(params.get('unit_id')).toBe(BUZZVIL_CONFIG.aos.unitId);
      expect(params.get('campaign_id')).toBe('10075328');
      expect(params.get('custom')).toBe('auth-123');
      expect(params.get('client_ip')).toBe('1.2.3.4');
      expect(params.get('payload')).toBe('zh8qPfFDUycs3d');
    });

    it('iOS 플랫폼이면 iOS app_id를 헤더에 사용한다', async () => {
      await service.participate({ ...requiredParams, platform: 'I' });

      const config = httpPost.mock.calls[0][2];
      expect(config.headers['Buzz-App-ID']).toBe(BUZZVIL_CONFIG.ios.appId);

      const body = httpPost.mock.calls[0][1];
      const params = new URLSearchParams(body);
      expect(params.get('unit_id')).toBe(BUZZVIL_CONFIG.ios.unitId);
    });

    it('Buzzvil 응답을 그대로 반환한다', async () => {
      const mockResponse = {
        code: 200,
        landing_url: 'https://ad-api.buzzvil.com/action/land',
        action_description: '참여 설명',
        call_to_action: '퀴즈 맞추기',
      };
      httpPost.mockReturnValue(of({ data: mockResponse }));

      const result = await service.participate(requiredParams);
      expect(result).toEqual(mockResponse);
    });
  });
});
