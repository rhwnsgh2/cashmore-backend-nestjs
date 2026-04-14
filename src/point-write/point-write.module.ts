import { Global, Module } from '@nestjs/common';
import { PointWriteService } from './point-write.service';
import { POINT_WRITE_REPOSITORY } from './point-write-repository.interface';
import { SupabasePointWriteRepository } from './repositories/supabase-point-write.repository';
import { POINT_WRITE_SERVICE } from './point-write.interface';
import { SlackModule } from '../slack/slack.module';

@Global()
@Module({
  imports: [SlackModule],
  providers: [
    {
      provide: POINT_WRITE_SERVICE,
      useClass: PointWriteService,
    },
    {
      provide: POINT_WRITE_REPOSITORY,
      useClass: SupabasePointWriteRepository,
    },
  ],
  exports: [POINT_WRITE_SERVICE],
})
export class PointWriteModule {}
