import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(private supabaseService: SupabaseService) {}

  async isDoublePointActive(userId: string): Promise<boolean> {
    const client = this.supabaseService.getClient();

    const { data, error } = (await client
      .from('user')
      .select('created_at')
      .eq('id', userId)
      .single()) as {
      data: { created_at: string } | null;
      error: { message: string } | null;
    };

    if (error || !data) {
      this.logger.error(
        `[DOUBLE_POINT] 유저 조회 실패 userId=${userId} error=${error?.message}`,
      );
      return false;
    }

    const joinDate = dayjs(data.created_at).tz('Asia/Seoul');
    const eventStartDate = joinDate.add(1, 'day').startOf('day');
    const eventEndDate = joinDate.add(1, 'day').endOf('day');
    const now = dayjs().tz('Asia/Seoul');

    return now.isAfter(eventStartDate) && now.isBefore(eventEndDate);
  }
}
