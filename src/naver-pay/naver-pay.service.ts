import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { INaverPayRepository } from './interfaces/naver-pay-repository.interface';
import { NAVER_PAY_REPOSITORY } from './interfaces/naver-pay-repository.interface';
import type { IDaouApiClient } from './interfaces/daou-api-client.interface';
import { DAOU_API_CLIENT } from './interfaces/daou-api-client.interface';

const MAX_DAILY_CONNECT_ATTEMPTS = 5;

const DAOU_ERROR_MESSAGES: Record<string, string> = {
  '52004': '네이버페이 가입 후 다시 시도해주세요',
  '52001': '네이버페이 계정 상태를 확인해주세요',
  '52002': '네이버페이 계정 상태를 확인해주세요',
};

@Injectable()
export class NaverPayService {
  constructor(
    @Inject(NAVER_PAY_REPOSITORY)
    private naverPayRepository: INaverPayRepository,
    @Inject(DAOU_API_CLIENT)
    private daouApiClient: IDaouApiClient,
  ) {}

  async getAccount(userId: string) {
    const account = await this.naverPayRepository.findConnectedAccount(userId);

    if (!account) {
      return { connected: false };
    }

    return {
      connected: true,
      maskingId: account.dau_masking_id ?? undefined,
      connectedAt: account.connected_at ?? undefined,
    };
  }

  async connectAccount(userId: string, uniqueId: string) {
    if (!uniqueId) {
      throw new BadRequestException('uniqueId is required');
    }

    const existingAccount =
      await this.naverPayRepository.findConnectedAccount(userId);

    if (existingAccount) {
      throw new BadRequestException(
        '이미 연결된 네이버페이 계정이 있습니다. 먼저 해제해주세요',
      );
    }

    const todayAttempts =
      await this.naverPayRepository.countTodayFailedAttempts(userId);

    if (todayAttempts >= MAX_DAILY_CONNECT_ATTEMPTS) {
      throw new BadRequestException(
        '오늘은 더 이상 시도할 수 없습니다. 내일 다시 시도해주세요',
      );
    }

    const result = await this.daouApiClient.lookupMember(uniqueId);

    if (!result.success) {
      await this.naverPayRepository.createAccount({
        user_id: userId,
        naver_unique_id: uniqueId,
        dau_user_key: null,
        dau_masking_id: null,
        status: 'failed',
        error_code: result.errorCode,
        connected_at: null,
      });

      const errorMessage =
        DAOU_ERROR_MESSAGES[result.errorCode] ??
        '네이버페이 연결에 실패했습니다. 잠시 후 다시 시도해주세요';

      return {
        success: false,
        errorCode: result.errorCode,
        errorMessage,
      };
    }

    await this.naverPayRepository.createAccount({
      user_id: userId,
      naver_unique_id: uniqueId,
      dau_user_key: result.data.userKey,
      dau_masking_id: result.data.maskingId,
      status: 'connected',
      error_code: null,
      connected_at: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        maskingId: result.data.maskingId,
        naverPayPoint: result.data.point,
      },
    };
  }

  async disconnectAccount(userId: string) {
    const account = await this.naverPayRepository.findConnectedAccount(userId);

    if (!account) {
      throw new NotFoundException('연결된 네이버페이 계정이 없습니다');
    }

    // TODO: naver_pay_exchanges에 pending 요청이 있으면 자동 취소 (포인트 복원) 후 해제

    await this.naverPayRepository.disconnectAccount(account.id);

    return { success: true };
  }
}
