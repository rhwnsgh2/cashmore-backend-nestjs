import { Inject, Injectable } from '@nestjs/common';
import type { IEveryReceiptRepository } from './interfaces/every-receipt-repository.interface';
import {
  EVERY_RECEIPT_REPOSITORY,
  EveryReceipt,
} from './interfaces/every-receipt-repository.interface';

export interface GetEveryReceiptsResult {
  receipts: EveryReceipt[];
}

@Injectable()
export class EveryReceiptService {
  constructor(
    @Inject(EVERY_RECEIPT_REPOSITORY)
    private everyReceiptRepository: IEveryReceiptRepository,
  ) {}

  async getEveryReceipts(userId: string): Promise<GetEveryReceiptsResult> {
    const receipts = await this.everyReceiptRepository.findByUserId(userId);

    return {
      receipts,
    };
  }
}
