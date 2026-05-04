import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SMARTCON_CONFIG } from './smartcon.constants';
import type { SmartconGetEventGoodsResponse } from './dto/smartcon-goods.dto';

@Injectable()
export class SmartconApiService {
  private readonly logger = new Logger(SmartconApiService.name);

  constructor(private httpService: HttpService) {}

  async getEventGoods(
    eventId: string = SMARTCON_CONFIG.eventId,
  ): Promise<SmartconGetEventGoodsResponse> {
    const url = `${SMARTCON_CONFIG.apiBaseUrl}/goodsinfosvc/GetEventGoods.sc`;

    const response = await firstValueFrom(
      this.httpService.get<SmartconGetEventGoodsResponse>(url, {
        params: { event_id: eventId },
      }),
    );

    this.logger.log(
      `getEventGoods eventId=${eventId} count=${response.data.length}`,
    );
    return response.data;
  }
}
