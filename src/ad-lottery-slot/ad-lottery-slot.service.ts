import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type {
  IAdLotterySlotRepository,
  SlotTime,
  SlotTimeRange,
} from './interfaces/ad-lottery-slot-repository.interface';
import { AD_LOTTERY_SLOT_REPOSITORY } from './interfaces/ad-lottery-slot-repository.interface';
import type { SlotAvailabilityResponseDto } from './dto/check-availability.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AdLotterySlotService {
  constructor(
    @Inject(AD_LOTTERY_SLOT_REPOSITORY)
    private adLotterySlotRepository: IAdLotterySlotRepository,
  ) {}

  /**
   * 현재 시간을 기준으로 슬롯 시간 범위 계산
   * - 09:00 슬롯: 09:00 ~ 13:00
   * - 13:00 슬롯: 13:00 ~ 18:00
   * - 18:00 슬롯: 18:00 ~ 22:00
   * - 22:00 슬롯: 22:00 ~ 다음날 09:00
   */
  getCurrentSlotTimeRange(now?: dayjs.Dayjs): SlotTimeRange {
    const currentTime = now ?? dayjs().tz('Asia/Seoul');
    const hour = currentTime.hour();

    // 09:00 슬롯: 09:00 ~ 13:00
    if (hour >= 9 && hour < 13) {
      return {
        slot: '09:00',
        startTime: currentTime
          .hour(9)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
        endTime: currentTime
          .hour(13)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
      };
    }

    // 13:00 슬롯: 13:00 ~ 18:00
    if (hour >= 13 && hour < 18) {
      return {
        slot: '13:00',
        startTime: currentTime
          .hour(13)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
        endTime: currentTime
          .hour(18)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
      };
    }

    // 18:00 슬롯: 18:00 ~ 22:00
    if (hour >= 18 && hour < 22) {
      return {
        slot: '18:00',
        startTime: currentTime
          .hour(18)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
        endTime: currentTime
          .hour(22)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
      };
    }

    // 22:00 슬롯: 22:00 ~ 다음날 09:00
    if (hour >= 22) {
      return {
        slot: '22:00',
        startTime: currentTime
          .hour(22)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
        endTime: currentTime
          .add(1, 'day')
          .hour(9)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
      };
    }

    // 0~9시 사이: 어제 22:00 ~ 오늘 09:00
    return {
      slot: '22:00',
      startTime: currentTime
        .subtract(1, 'day')
        .hour(22)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toISOString(),
      endTime: currentTime
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toISOString(),
    };
  }

  /**
   * 다음 슬롯 정보 계산
   */
  getNextSlot(
    currentSlot: SlotTime,
    now?: dayjs.Dayjs,
  ): { slot: SlotTime; time: string } {
    const currentTime = now ?? dayjs().tz('Asia/Seoul');

    const slotMap: Record<
      SlotTime,
      { next: SlotTime; hour: number; addDay: number }
    > = {
      '09:00': { next: '13:00', hour: 13, addDay: 0 },
      '13:00': { next: '18:00', hour: 18, addDay: 0 },
      '18:00': { next: '22:00', hour: 22, addDay: 0 },
      '22:00': { next: '09:00', hour: 9, addDay: 1 },
    };

    const nextSlotInfo = slotMap[currentSlot];
    const nextTime = currentTime
      .add(nextSlotInfo.addDay, 'day')
      .hour(nextSlotInfo.hour)
      .minute(0)
      .second(0)
      .millisecond(0)
      .toISOString();

    return {
      slot: nextSlotInfo.next,
      time: nextTime,
    };
  }

  /**
   * 광고 시청 가능 여부 확인
   */
  async checkAvailability(userId: string): Promise<SlotAvailabilityResponseDto> {
    const currentSlotRange = this.getCurrentSlotTimeRange();
    const { slot: currentSlot, startTime } = currentSlotRange;

    const hasWatched = await this.adLotterySlotRepository.hasWatchedInSlot(
      userId,
      currentSlot,
      startTime,
    );

    const nextSlotInfo = this.getNextSlot(currentSlot);

    return {
      available: !hasWatched,
      currentSlot,
      nextSlot: hasWatched ? nextSlotInfo.slot : undefined,
      nextSlotTime: hasWatched ? nextSlotInfo.time : undefined,
      message: hasWatched
        ? `다음 슬롯은 ${nextSlotInfo.slot}입니다`
        : `현재 ${currentSlot} 슬롯을 시청할 수 있습니다`,
    };
  }
}
