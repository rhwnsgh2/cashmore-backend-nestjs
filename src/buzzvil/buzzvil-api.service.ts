import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BUZZVIL_CONFIG } from './buzzvil.constants';

@Injectable()
export class BuzzvilApiService {
  private readonly logger = new Logger(BuzzvilApiService.name);

  constructor(private httpService: HttpService) {}

  async getAds(params: {
    userId: string;
    clientIp: string;
    ifa: string;
    platform: 'A' | 'I';
    birthday?: string;
    gender?: string;
    carrier?: string;
    deviceName?: string;
    userAgent?: string;
    cursor?: string;
  }) {
    const revenueTypes = JSON.stringify([
      'cpa',
      'cpq',
      'cpqlite',
      'cpk',
      'cpl',
      'cpyoutube',
      'cpylike',
      'cpinsta',
      'cps',
      'cptiktok',
      'cpnstore',
      'cpe',
      'cpcquiz',
    ]);

    const appConfig =
      params.platform === 'A' ? BUZZVIL_CONFIG.aos : BUZZVIL_CONFIG.ios;

    const queryParams: Record<string, string | number> = {
      app_id: appConfig.appId,
      unit_id: appConfig.unitId,
      country: 'KR',
      target_fill: 5,
      revenue_types: revenueTypes,
      user_id: params.userId,
      client_ip: params.clientIp,
      ifa: params.ifa,
      platform: params.platform,
    };

    if (params.birthday) queryParams.birthday = params.birthday;
    if (params.gender) queryParams.gender = params.gender;
    if (params.carrier) queryParams.carrier = params.carrier;
    if (params.deviceName) queryParams.device_name = params.deviceName;
    if (params.userAgent) queryParams.user_agent = params.userAgent;
    if (params.cursor) queryParams.cursor = params.cursor;

    const response = await firstValueFrom(
      this.httpService.get(`${BUZZVIL_CONFIG.apiBaseUrl}/api/s2s/ads`, {
        params: queryParams,
      }),
    );

    return response.data;
  }

  async participate(params: {
    userId: string;
    clientIp: string;
    ifa: string;
    platform: 'A' | 'I';
    campaignId: number;
    payload: string;
    deviceName?: string;
    carrier?: string;
  }) {
    const appConfig =
      params.platform === 'A' ? BUZZVIL_CONFIG.aos : BUZZVIL_CONFIG.ios;

    const body = new URLSearchParams();
    body.append('unit_id', appConfig.unitId);
    body.append('campaign_id', String(params.campaignId));
    body.append('custom', params.userId);
    body.append('client_ip', params.clientIp);
    body.append('payload', params.payload);
    if (params.deviceName) body.append('device_name', params.deviceName);
    if (params.carrier) body.append('carrier', params.carrier);

    const response = await firstValueFrom(
      this.httpService.post(
        `${BUZZVIL_CONFIG.apiBaseUrl}/api/participate`,
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Buzz-App-ID': appConfig.appId,
            'Buzz-Publisher-User-ID': params.userId,
            'Buzz-IFA': params.ifa,
          },
        },
      ),
    );

    return response.data;
  }
}
