import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { IDividendRepository } from './interfaces/dividend-repository.interface';
import { DIVIDEND_REPOSITORY } from './interfaces/dividend-repository.interface';
import type { SimulateResult } from './interfaces/dividend-repository.interface';

@Injectable()
export class DividendService {
  constructor(
    @Inject(DIVIDEND_REPOSITORY)
    private dividendRepository: IDividendRepository,
  ) {}

  async getSimulateData(year: string, month: string): Promise<SimulateResult> {
    if (!year || !month) {
      throw new BadRequestException('year와 month 파라미터가 필요합니다.');
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('유효하지 않은 year 또는 month 값입니다.');
    }

    const startDate = `${year}-${month.padStart(2, '0')}-01T00:00:00+09:00`;
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? yearNum + 1 : yearNum;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`;

    return this.dividendRepository.getSimulateData(startDate, endDate);
  }
}
