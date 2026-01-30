import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IEveryReceiptRepository } from './interfaces/every-receipt-repository.interface';
import {
  EVERY_RECEIPT_REPOSITORY,
  EveryReceipt,
} from './interfaces/every-receipt-repository.interface';
import { buildScoreResponse } from './utils/score.util';
import { EveryReceiptDetailResponseDto } from './dto/get-every-receipt-detail.dto';

@Injectable()
export class EveryReceiptService {
  constructor(
    @Inject(EVERY_RECEIPT_REPOSITORY)
    private everyReceiptRepository: IEveryReceiptRepository,
  ) {}

  async getEveryReceipts(userId: string): Promise<EveryReceipt[]> {
    return this.everyReceiptRepository.findByUserId(userId);
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
