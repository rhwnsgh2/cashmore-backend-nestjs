import { Module } from '@nestjs/common';
import { NoticeController } from './notice.controller';
import { NoticeService } from './notice.service';
import { NOTICE_REPOSITORY } from './interfaces/notice-repository.interface';
import { SupabaseNoticeRepository } from './repositories/supabase-notice.repository';

@Module({
  controllers: [NoticeController],
  providers: [
    NoticeService,
    {
      provide: NOTICE_REPOSITORY,
      useClass: SupabaseNoticeRepository,
    },
  ],
})
export class NoticeModule {}
