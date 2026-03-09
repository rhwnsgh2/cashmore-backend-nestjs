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
import { ReceiptQueueService } from './receipt-queue.service';
import { AmplitudeService } from '../amplitude/amplitude.service';

@Injectable()
export class EveryReceiptService {
  private readonly logger = new Logger(EveryReceiptService.name);

  constructor(
    @Inject(EVERY_RECEIPT_REPOSITORY)
    private everyReceiptRepository: IEveryReceiptRepository,
    private receiptQueueService: ReceiptQueueService,
    private amplitudeService: AmplitudeService,
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
