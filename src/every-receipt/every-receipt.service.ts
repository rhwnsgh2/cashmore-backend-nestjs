import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import { AdminDeleteReceiptResponseDto } from './dto/admin-delete-receipt.dto';
import { AdminUpdatePointResponseDto } from './dto/admin-update-point.dto';
import { AdminCompleteReReviewResponseDto } from './dto/admin-complete-re-review.dto';
import { ReceiptQueueService } from './receipt-queue.service';
import { AmplitudeService } from '../amplitude/amplitude.service';
import { EventService } from '../event/event.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { FcmService } from '../fcm/fcm.service';
import { UserModalService } from '../user-modal/user-modal.service';
import { SlackService } from '../slack/slack.service';
import type { IPointWriteService } from '../point-write/point-write.interface';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';

// 포인트 → 등급 계산 (cash-more-web의 getGradeFromPoint 이관)
function getGradeFromPoint(point: number): string {
  if (point >= 40) return 'S';
  if (point >= 30) return 'A+';
  if (point >= 25) return 'A';
  if (point >= 20) return 'B+';
  if (point >= 15) return 'B';
  if (point >= 10) return 'C';
  if (point >= 5) return 'D';
  if (point >= 3) return 'E';
  return 'F';
}

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
    private userModalService: UserModalService,
    private slackService: SlackService,
    @Inject(POINT_WRITE_SERVICE)
    private pointWriteService: IPointWriteService,
  ) {}

  async getEveryReceipts(userId: string): Promise<EveryReceipt[]> {
    return this.everyReceiptRepository.findByUserId(userId);
  }

  async requestReReview(
    userId: string,
    receiptId: number,
    requestedItems: string[],
    userNote: string,
  ): Promise<{ success: boolean; reReview: Record<string, unknown> }> {
    const everyReceipt =
      await this.everyReceiptRepository.findEveryReceiptForReReview(
        receiptId,
        userId,
      );
    if (!everyReceipt) {
      throw new NotFoundException('영수증을 찾을 수 없습니다.');
    }

    const hasExisting =
      await this.everyReceiptRepository.hasExistingReReview(receiptId);
    if (hasExisting) {
      throw new BadRequestException('이미 재검수 요청이 존재합니다.');
    }

    // 재검수 레코드를 먼저 생성해서 reversal 행이 참조할 ID를 확보
    const reReview = await this.everyReceiptRepository.createReReview({
      everyReceiptId: receiptId,
      requestedItems,
      userNote: userNote || '',
      userId,
      beforeScoreData: everyReceipt.score_data,
    });

    // 포인트 환수 — append-only reversal INSERT
    // 원본 EVERY_RECEIPT 행은 그대로 두고, 반대 부호 행을 추가한다.
    // 0점 영수증인 경우 -0이 아닌 0으로 기록한다.
    const reversalAmount = everyReceipt.point === 0 ? 0 : -everyReceipt.point;
    await this.pointWriteService.addPoint({
      userId,
      amount: reversalAmount,
      type: 'EVERY_RECEIPT',
      additionalData: {
        every_receipt_id: receiptId,
        every_receipt_re_review_id: reReview.id,
        reason: 'user_review',
      },
    });

    // 영수증 상태 업데이트
    await this.everyReceiptRepository.updateStatusToReReview(receiptId);

    return { success: true, reReview };
  }

  async getReReviewTickets(userId: string): Promise<{
    ticketCount: number;
    usedTickets: number;
    totalTickets: number;
  }> {
    const mondayStart = this.getThisWeekMonday();
    const reReviews = await this.everyReceiptRepository.findReReviewsSince(
      userId,
      mondayStart,
    );

    const usedTickets = reReviews.filter(
      (r) => r.status === 'pending' || r.status === 'rejected',
    ).length;

    const totalTickets = 5;
    const remainingTickets = Math.max(0, totalTickets - usedTickets);

    return {
      ticketCount: remainingTickets,
      usedTickets,
      totalTickets,
    };
  }

  private getThisWeekMonday(): string {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (일요일) ~ 6 (토요일)
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }

  async getCompletedCount(userId: string): Promise<{ count: number }> {
    const count =
      await this.everyReceiptRepository.countCompletedByUserId(userId);
    return { count };
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
    await this.pointWriteService.addPoint({
      userId: receipt.userId,
      amount: finalPoint,
      type: 'EVERY_RECEIPT',
      additionalData: { every_receipt_id: everyReceiptId },
    });

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

  // Admin ---------------------------------------------------------------------

  async adminDeleteReceipt(
    receiptId: number,
  ): Promise<AdminDeleteReceiptResponseDto> {
    const receipt =
      await this.everyReceiptRepository.findReceiptForAdmin(receiptId);
    if (!receipt) {
      throw new NotFoundException('영수증을 찾을 수 없습니다.');
    }

    // completed 상태에서만 원장에 기여분이 있으므로 reversal 행 추가
    if (receipt.status === 'completed' && receipt.point > 0) {
      await this.pointWriteService.addPoint({
        userId: receipt.user_id,
        amount: -receipt.point,
        type: 'EVERY_RECEIPT',
        additionalData: {
          every_receipt_id: receipt.id,
          reason: 'admin_delete',
          before_point: receipt.point,
          after_point: 0,
        },
      });
    }

    await this.everyReceiptRepository.deleteReceipt(receiptId);

    return { success: true, message: '영수증이 삭제되었습니다.' };
  }

  async adminUpdatePoint(
    receiptId: number,
    newPoint: number,
  ): Promise<AdminUpdatePointResponseDto> {
    const receipt =
      await this.everyReceiptRepository.findReceiptForAdmin(receiptId);
    if (!receipt) {
      throw new NotFoundException('영수증을 찾을 수 없습니다.');
    }

    const oldPoint = receipt.point;

    // every_receipt.point 업데이트
    await this.everyReceiptRepository.updateReceiptPoint(receiptId, newPoint);

    // completed 상태일 때만 원장에 delta 행 추가 (불변식 유지)
    if (receipt.status === 'completed') {
      const delta = newPoint - oldPoint;
      if (delta !== 0) {
        await this.pointWriteService.addPoint({
          userId: receipt.user_id,
          amount: delta,
          type: 'EVERY_RECEIPT',
          additionalData: {
            every_receipt_id: receipt.id,
            reason: 'admin_adjust',
            before_point: oldPoint,
            after_point: newPoint,
          },
        });
      }
    }

    return { success: true };
  }

  async adminCompleteReReview(params: {
    everyReceiptId: number;
    afterScoreData: Record<string, unknown>;
    afterPoint: number;
    afterTotalScore: number;
  }): Promise<AdminCompleteReReviewResponseDto> {
    const { everyReceiptId, afterScoreData, afterPoint, afterTotalScore } =
      params;

    try {
      const reReview =
        await this.everyReceiptRepository.findReReviewByReceiptId(
          everyReceiptId,
        );
      if (!reReview) {
        throw new NotFoundException('재검수 요청을 찾을 수 없습니다.');
      }
      if (reReview.status !== 'pending') {
        throw new BadRequestException('이미 처리된 재검수 요청입니다.');
      }

      const receipt =
        await this.everyReceiptRepository.findReceiptForAdmin(everyReceiptId);
      if (!receipt) {
        throw new NotFoundException('영수증을 찾을 수 없습니다.');
      }

      const beforePoint = receipt.point;
      const beforeGrade = getGradeFromPoint(beforePoint);

      // 분기 A: 점수 유지/하락 → 원래 포인트 재지급
      if (afterPoint <= beforePoint) {
        await this.everyReceiptRepository.updateReReviewToRejected(reReview.id);
        await this.everyReceiptRepository.updateReceiptStatusToCompleted(
          everyReceiptId,
        );

        if (beforePoint > 0) {
          await this.pointWriteService.addPoint({
            userId: receipt.user_id,
            amount: beforePoint,
            type: 'EVERY_RECEIPT',
            additionalData: {
              every_receipt_id: everyReceiptId,
              every_receipt_re_review_id: reReview.id,
              reason: 're_review_rejected',
            },
          });
        }

        await this.userModalService.createModal(
          receipt.user_id,
          'every_receipt_re_reviewed',
          {
            everyReceiptId,
            beforeGrade,
            beforePoint,
            afterGrade: beforeGrade,
            afterPoint: beforePoint,
          },
        );
        await this.fcmService.sendRefreshMessage(
          receipt.user_id,
          'receipt_update',
        );

        return {
          success: true,
          message: '재검수 포인트가 변경되지 않았습니다.',
        };
      }

      // 분기 B: 점수 상승 → 새 포인트 지급
      const finalScoreData = {
        ...afterScoreData,
        total_score: afterTotalScore,
      };

      await this.everyReceiptRepository.updateReReviewToCompleted(
        reReview.id,
        afterScoreData,
      );
      await this.everyReceiptRepository.updateReceiptAfterReReview(
        everyReceiptId,
        finalScoreData,
        afterPoint,
      );

      await this.pointWriteService.addPoint({
        userId: receipt.user_id,
        amount: afterPoint,
        type: 'EVERY_RECEIPT',
        additionalData: {
          every_receipt_id: everyReceiptId,
          every_receipt_re_review_id: reReview.id,
          reason: 're_review_approved',
        },
      });

      const afterGrade = getGradeFromPoint(afterPoint);

      await this.userModalService.createModal(
        receipt.user_id,
        'every_receipt_re_reviewed',
        {
          everyReceiptId,
          beforeGrade,
          beforePoint,
          afterGrade,
          afterPoint,
        },
      );
      await this.fcmService.pushNotification(
        receipt.user_id,
        '영수증 재검수 완료 💌',
        '재검수를 통해 영수증 포인트가 상승했어요!',
        {},
      );

      return { success: true };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`재검수 완료 처리 중 오류: ${message}`);
      await this.slackService.reportBugToSlack(
        `재검수 완료 처리 중 오류 발생 receiptId=${everyReceiptId} ${message}`,
      );
      throw error;
    }
  }
}
