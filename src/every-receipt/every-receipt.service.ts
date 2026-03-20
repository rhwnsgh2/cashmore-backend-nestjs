import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { IEveryReceiptRepository } from './interfaces/every-receipt-repository.interface';
import {
  EVERY_RECEIPT_REPOSITORY,
  EveryReceipt,
} from './interfaces/every-receipt-repository.interface';
import { buildScoreResponse } from './utils/score.util';
import { EveryReceiptDetailResponseDto } from './dto/get-every-receipt-detail.dto';
import { MonthlyReceiptCountResponseDto } from './dto/get-monthly-receipt-count.dto';
import { ConfirmUploadResponseDto } from './dto/confirm-upload.dto';
import { CompleteReceiptResponseDto } from './dto/complete-receipt.dto';
import { ReceiptQueueService } from './receipt-queue.service';
import { AmplitudeService } from '../amplitude/amplitude.service';
import { EventService } from '../event/event.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class EveryReceiptService {
  private readonly logger = new Logger(EveryReceiptService.name);

  constructor(
    @Inject(EVERY_RECEIPT_REPOSITORY)
    private everyReceiptRepository: IEveryReceiptRepository,
    private receiptQueueService: ReceiptQueueService,
    private amplitudeService: AmplitudeService,
    private eventService: EventService,
    private onboardingService: OnboardingService,
    private fcmService: FcmService,
  ) {}

  async getEveryReceipts(userId: string): Promise<EveryReceipt[]> {
    return this.everyReceiptRepository.findByUserId(userId);
  }

  async getMonthlyReceiptCount(
    userId: string,
  ): Promise<MonthlyReceiptCountResponseDto> {
    const now = new Date();
    const count = await this.everyReceiptRepository.countByUserIdAndMonth(
      userId,
      now.getFullYear(),
      now.getMonth() + 1,
    );
    return { count };
  }

  async confirmUpload(
    userId: string,
    publicUrl: string,
    currentPosition: string | null,
  ): Promise<ConfirmUploadResponseDto> {
    const inserted = await this.everyReceiptRepository.insert({
      userId,
      imageUrl: publicUrl,
      position: currentPosition,
    });

    this.receiptQueueService
      .publish({
        imageUrl: publicUrl,
        userId,
        everyReceiptId: inserted.id,
      })
      .catch((err: Error) => {
        this.logger.error(
          `PubSub 발행 실패. receiptId=${inserted.id}, error=${err.message}`,
        );
      });

    this.amplitudeService.track('daily_receipt_uploaded', userId, {
      everyReceiptId: inserted.id,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      everyReceiptId: inserted.id,
      imageUrl: publicUrl,
    };
  }

  async completeReceipt(
    everyReceiptId: number,
  ): Promise<CompleteReceiptResponseDto> {
    const receipt =
      await this.everyReceiptRepository.findPendingWithScoreData(
        everyReceiptId,
      );

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    // 1. 온보딩/더블포인트 이벤트 확인 → 포인트 2배
    const isOnboardingToday = await this.onboardingService.getEventStatus(
      receipt.userId,
    );
    let isOnboardingReceipt = false;
    if (isOnboardingToday) {
      isOnboardingReceipt = await this.everyReceiptRepository.isFirstReceipt(
        receipt.userId,
        everyReceiptId,
      );
    }

    const isDoublePoint = await this.eventService.isDoublePointActive(
      receipt.userId,
    );

    let finalPoint = receipt.point;

    if (isOnboardingReceipt || isDoublePoint) {
      finalPoint = receipt.point * 2;
      await this.everyReceiptRepository.updatePoint(everyReceiptId, finalPoint);
    }

    // 2. 중복 영수증 판별 → reject
    if (
      receipt.point === 0 &&
      receipt.scoreData.is_duplicate_receipt === true
    ) {
      await this.everyReceiptRepository.updateToRejected(
        everyReceiptId,
        '중복된 영수증 제출',
      );
      await this.fcmService.sendRefreshMessage(
        receipt.userId,
        'receipt_update',
      );
      return { success: true };
    }

    // 3. 정상 완료 처리
    await this.everyReceiptRepository.updateToCompleted(everyReceiptId);
    await this.everyReceiptRepository.createPointAction(
      receipt.userId,
      everyReceiptId,
      finalPoint,
    );

    // 4. 알림
    await this.fcmService.pushNotification(
      receipt.userId,
      'AI 영수증 분석이 완료됐어요 🤖',
      finalPoint > 0
        ? `바로 ${finalPoint}포인트를 지급할게요!`
        : '아쉽지만 포인트를 지급할 수 없어요',
      {},
    );
    await this.fcmService.sendRefreshMessage(receipt.userId, 'receipt_update');

    return { success: true };
  }

  async getEveryReceiptDetail(
    receiptId: number,
    userId: string,
  ): Promise<EveryReceiptDetailResponseDto> {
    const detail = await this.everyReceiptRepository.findById(
      receiptId,
      userId,
    );

    if (!detail) {
      throw new NotFoundException('Receipt not found');
    }

    const reReviewStatus =
      await this.everyReceiptRepository.findReReviewStatus(receiptId);

    const base = {
      id: detail.id,
      createdAt: detail.createdAt,
      pointAmount: detail.pointAmount,
      adShowPoint: 0,
      status: detail.status,
      imageUrl: detail.imageUrl,
      reReviewStatus,
    };

    if (!detail.scoreData) {
      return base;
    }

    return {
      ...base,
      ...buildScoreResponse(detail.scoreData, detail.pointAmount ?? 0),
    };
  }
}
