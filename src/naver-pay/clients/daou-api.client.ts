import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IDaouApiClient,
  DaouMemberResult,
  DaouEarnPointResult,
} from '../interfaces/daou-api-client.interface';
import { DAOU_CONFIG } from '../naver-pay.config';
import { encrypt } from '../utils/daou-crypto.util';

interface TokenResponse {
  accessToken: string;
  expireIn: string;
}

@Injectable()
export class DaouApiClient implements IDaouApiClient {
  private readonly logger = new Logger(DaouApiClient.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {}

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch(`${DAOU_CONFIG.apiUrl}/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pointbox-partner-code': DAOU_CONFIG.partnerCode,
      },
      body: JSON.stringify({ apiKey: DAOU_CONFIG.apiKey }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`토큰 발급 실패: ${response.status} ${errorBody}`);
      throw new Error(`다우기술 토큰 발급 실패: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.accessToken;

    // expireIn을 초 단위로 파싱, 1분 여유를 두고 만료 시간 설정
    const expireInSeconds = parseInt(data.expireIn, 10);
    this.tokenExpiresAt = Date.now() + (expireInSeconds - 60) * 1000;

    this.logger.log(`토큰 발급 성공, 유효 기간: ${data.expireIn}초`);
    return this.accessToken;
  }

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getToken();

    const response = await fetch(`${DAOU_CONFIG.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pointbox-partner-code': DAOU_CONFIG.partnerCode,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `API 호출 실패: ${path} ${response.status} ${errorBody}`,
      );

      // 401이면 토큰 만료 → 캐시 초기화 후 재시도
      if (response.status === 401) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
      }

      throw new Error(`다우기술 API 호출 실패: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async lookupMember(uniqueId: string): Promise<DaouMemberResult> {
    const clientId = this.configService.get<string>('NAVER_CLIENT_ID');
    const clientSecret = this.configService.get<string>('NAVER_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error(
        'NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다',
      );
    }

    try {
      const encryptedBody = {
        uniqueId: encrypt(uniqueId),
        clientId: encrypt(clientId),
        clientSecret: encrypt(clientSecret),
      };

      const data = await this.request<
        | { maskingId: string; point: number; userKey: string }
        | { code: string; message: string }
      >('/v1/npay/members/nid', encryptedBody);

      if ('code' in data) {
        this.logger.warn(`회원 조회 실패: ${data.code} ${data.message}`);
        return {
          success: false,
          errorCode: data.code,
          errorMessage: data.message,
        };
      }

      return {
        success: true,
        data: {
          maskingId: data.maskingId,
          point: data.point,
          userKey: data.userKey,
        },
      };
    } catch (error) {
      this.logger.error(`회원 조회 예외: ${error}`);
      throw error;
    }
  }

  async earnPoint(
    userKey: string,
    partnerTxNo: string,
    point: number,
  ): Promise<DaouEarnPointResult> {
    try {
      const data = await this.request<
        { txNo: string } | { code: string; message: string }
      >('/v1/npay/point', {
        userKey: encrypt(userKey),
        partnerTxNo,
        point,
      });

      if ('code' in data) {
        this.logger.warn(`포인트 적립 실패: ${data.code} ${data.message}`);
        return {
          success: false,
          errorCode: data.code,
          errorMessage: data.message,
        };
      }

      return { success: true, txNo: data.txNo };
    } catch (error) {
      this.logger.error(`포인트 적립 예외: ${error}`);
      throw error;
    }
  }
}
