import { Inject, Injectable } from '@nestjs/common';
import type { INoticeRepository } from './interfaces/notice-repository.interface';
import {
  NOTICE_REPOSITORY,
  Notice,
} from './interfaces/notice-repository.interface';

@Injectable()
export class NoticeService {
  constructor(
    @Inject(NOTICE_REPOSITORY)
    private noticeRepository: INoticeRepository,
  ) {}

  async getNotices(): Promise<Notice[]> {
    return this.noticeRepository.findVisible();
  }
}
