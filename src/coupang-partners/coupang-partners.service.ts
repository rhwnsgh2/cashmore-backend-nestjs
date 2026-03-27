import { Inject, Injectable } from '@nestjs/common';
import type { ICoupangPostbackRepository } from './interfaces/coupang-postback-repository.interface';
import { COUPANG_POSTBACK_REPOSITORY } from './interfaces/coupang-postback-repository.interface';
import type { CoupangPostbackRequestDto } from './dto/coupang-postback.dto';

@Injectable()
export class CoupangPartnersService {
  constructor(
    @Inject(COUPANG_POSTBACK_REPOSITORY)
    private postbackRepository: ICoupangPostbackRepository,
  ) {}

  async handlePostback(
    dto: CoupangPostbackRequestDto,
  ): Promise<{ result: string; message: string }> {
    await this.postbackRepository.save({
      afcode: dto.afcode,
      subid: dto.subid,
      os: dto.os,
      adid: dto.adid,
      clickId: dto.click_id,
      orderTime: dto.order_time,
      orderPrice: dto.order_price,
      purchaseCancel: dto.purchase_cancel,
    });

    return { result: 'S', message: 'OK' };
  }
}
