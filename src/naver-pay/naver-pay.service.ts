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
import { PointService } from '../point/point.service';
import { SlackService } from '../slack/slack.service';
import { generatePartnerTxNo } from './utils/partner-tx-no.util';

const MAX_DAILY_CONNECT_ATTEMPTS = 5;

const EXCHANGE_CONFIG = {
  exchangeRate: 1.01,
  minPoint: 1000,
  dailyLimit: 1,
};

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
    private pointService: PointService,
    private slackService: SlackService,
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

    // pending 전환 요청이 있으면 해제 거부
    const pendingExchanges =
      await this.naverPayRepository.findPendingExchangesByUserId(userId);

    if (pendingExchanges.length > 0) {
      throw new BadRequestException(
        '진행 중인 전환 요청이 있습니다. 전환 요청을 취소한 후 해제해주세요',
      );
    }

    await this.naverPayRepository.disconnectAccount(account.id);

    return { success: true };
  }

  // --- 포인트 전환 ---

  async createExchange(userId: string, point: number) {
    // 1. 네이버페이 계정 연결 확인
    const account = await this.naverPayRepository.findConnectedAccount(userId);

    if (!account) {
      throw new BadRequestException('네이버페이 계정을 먼저 연결해주세요');
    }

    // 2. 최소 전환 금액 검증
    if (point < EXCHANGE_CONFIG.minPoint) {
      throw new BadRequestException(
        `최소 ${EXCHANGE_CONFIG.minPoint}P부터 전환 가능합니다`,
      );
    }

    // 3. 일일 요청 제한 확인
    const todayCount =
      await this.naverPayRepository.countTodayExchanges(userId);

    if (todayCount >= EXCHANGE_CONFIG.dailyLimit) {
      throw new BadRequestException('오늘 이미 전환 요청을 하셨습니다');
    }

    // 4. 보유 포인트 잔액 확인
    const pointTotal = await this.pointService.getPointTotal(userId);

    if (pointTotal.totalPoint < point) {
      throw new BadRequestException('포인트가 부족합니다');
    }

    // 5. 전환 비율 적용
    const naverpayPoint = Math.floor(point * EXCHANGE_CONFIG.exchangeRate);

    // 6. naver_pay_exchanges insert (먼저)
    const exchange = await this.naverPayRepository.createExchange({
      user_id: userId,
      naver_pay_account_id: account.id,
      cashmore_point: point,
      naverpay_point: naverpayPoint,
      exchange_rate: EXCHANGE_CONFIG.exchangeRate,
    });

    // 7. 포인트 차감
    try {
      const { pointActionId } = await this.pointService.deductPoint(
        userId,
        point,
        'EXCHANGE_POINT_TO_NAVERPAY',
        { exchange_id: exchange.id },
      );

      // point_action_id를 exchange에 저장
      await this.naverPayRepository.updateExchangePointActionId(
        exchange.id,
        pointActionId,
      );
    } catch (error) {
      // 포인트 차감 실패 시 exchange row 삭제
      await this.naverPayRepository.deleteExchange(exchange.id);
      throw error;
    }

    return {
      success: true,
      data: {
        exchangeId: exchange.id,
        cashmorePoint: exchange.cashmore_point,
        naverpayPoint: exchange.naverpay_point,
        status: exchange.status,
      },
    };
  }

  async cancelExchange(userId: string, exchangeId: string) {
    const exchange = await this.naverPayRepository.findExchangeById(exchangeId);

    if (!exchange) {
      throw new NotFoundException('전환 요청을 찾을 수 없습니다');
    }

    if (exchange.user_id !== userId) {
      throw new BadRequestException('본인의 전환 요청만 취소할 수 있습니다');
    }

    if (exchange.status !== 'pending') {
      throw new BadRequestException('대기 중인 요청만 취소할 수 있습니다');
    }

    // 포인트 복원
    if (exchange.point_action_id) {
      await this.pointService.restorePoint(
        userId,
        exchange.cashmore_point,
        'EXCHANGE_POINT_TO_NAVERPAY',
        exchange.point_action_id,
        { exchange_id: exchange.id },
      );
    }

    // 상태 업데이트
    await this.naverPayRepository.updateExchangeStatus(
      exchangeId,
      'cancelled',
      new Date().toISOString(),
    );

    return { success: true };
  }

  async getExchanges(userId: string) {
    const exchanges =
      await this.naverPayRepository.findExchangesByUserId(userId);

    return {
      exchanges: exchanges.map((e) => ({
        id: e.id,
        cashmorePoint: e.cashmore_point,
        naverpayPoint: e.naverpay_point,
        status: e.status,
        createdAt: e.created_at,
        processedAt: e.processed_at ?? undefined,
      })),
    };
  }

  async getExchangeConfig(userId: string) {
    const todayUsed = await this.naverPayRepository.countTodayExchanges(userId);

    return {
      exchangeRate: EXCHANGE_CONFIG.exchangeRate,
      minPoint: EXCHANGE_CONFIG.minPoint,
      dailyLimit: EXCHANGE_CONFIG.dailyLimit,
      todayUsed,
    };
  }

  // --- 관리자용 ---

  async getExchangesByStatus(status?: string) {
    const exchanges =
      await this.naverPayRepository.findExchangesByStatus(status);

    return {
      exchanges: exchanges.map((e) => ({
        id: e.id,
        userId: e.user_id,
        userEmail: e.user_email ?? undefined,
        cashmorePoint: e.cashmore_point,
        naverpayPoint: e.naverpay_point,
        status: e.status,
        createdAt: e.created_at,
        processedAt: e.processed_at ?? undefined,
      })),
    };
  }

  async approveExchange(exchangeId: string) {
    const exchange = await this.naverPayRepository.findExchangeById(exchangeId);

    if (!exchange) {
      throw new NotFoundException('전환 요청을 찾을 수 없습니다');
    }

    if (exchange.status !== 'pending') {
      throw new BadRequestException('대기 중인 요청만 승인할 수 있습니다');
    }

    // 연결된 계정 조회 (userKey 필요)
    const account = await this.naverPayRepository.findConnectedAccount(
      exchange.user_id,
    );

    if (!account || !account.dau_user_key) {
      throw new BadRequestException(
        '유저의 네이버페이 계정 정보를 찾을 수 없습니다',
      );
    }

    // 상태를 approved로 변경
    await this.naverPayRepository.updateExchangeStatus(
      exchangeId,
      'approved',
      new Date().toISOString(),
    );

    // partnerTxNo 생성 + 다우 API 호출
    const partnerTxNo = generatePartnerTxNo();
    await this.naverPayRepository.updateExchangePartnerTxNo(
      exchangeId,
      partnerTxNo,
    );

    const result = await this.daouApiClient.earnPoint(
      account.dau_user_key,
      partnerTxNo,
      exchange.naverpay_point,
    );

    if (result.success) {
      await this.naverPayRepository.updateExchangeTxNo(exchangeId, result.txNo);
      await this.naverPayRepository.updateExchangeStatus(
        exchangeId,
        'completed',
      );
      return { success: true, status: 'completed', txNo: result.txNo };
    }

    // 적립 실패 → 포인트 복원 + failed
    if (exchange.point_action_id) {
      await this.pointService.restorePoint(
        exchange.user_id,
        exchange.cashmore_point,
        'EXCHANGE_POINT_TO_NAVERPAY',
        exchange.point_action_id,
        { exchange_id: exchange.id },
      );
    }

    await this.naverPayRepository.updateExchangeStatus(exchangeId, 'failed');
    await this.naverPayRepository.updateExchangeErrorCode(
      exchangeId,
      result.errorCode,
    );

    // 슬랙 리포트
    const kstTime = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
    });
    await this.slackService.reportBugToSlack(
      [
        '🚨 네이버페이 포인트 적립 실패',
        `• exchangeId: ${exchangeId}`,
        `• userId: ${exchange.user_id}`,
        `• partnerTxNo: ${partnerTxNo}`,
        `• 요청 포인트: ${exchange.naverpay_point}P`,
        `• 에러코드: ${result.errorCode}`,
        `• 에러메시지: ${result.errorMessage}`,
        `• 시각: ${kstTime}`,
      ].join('\n'),
    );

    return {
      success: false,
      status: 'failed',
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  }

  async rejectExchange(exchangeId: string) {
    const exchange = await this.naverPayRepository.findExchangeById(exchangeId);

    if (!exchange) {
      throw new NotFoundException('전환 요청을 찾을 수 없습니다');
    }

    if (exchange.status !== 'pending') {
      throw new BadRequestException('대기 중인 요청만 거절할 수 있습니다');
    }

    // 포인트 복원
    if (exchange.point_action_id) {
      await this.pointService.restorePoint(
        exchange.user_id,
        exchange.cashmore_point,
        'EXCHANGE_POINT_TO_NAVERPAY',
        exchange.point_action_id,
        { exchange_id: exchange.id },
      );
    }

    // 상태 업데이트
    await this.naverPayRepository.updateExchangeStatus(
      exchangeId,
      'rejected',
      new Date().toISOString(),
    );

    return { success: true };
  }
}
