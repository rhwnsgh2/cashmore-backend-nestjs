import { Module } from '@nestjs/common';
import { DeeplinkController } from './deeplink.controller';
import { DeeplinkService } from './deeplink.service';
import { DEEPLINK_REPOSITORY } from './interfaces/deeplink-repository.interface';
import { UpstashDeeplinkRepository } from './repositories/upstash-deeplink.repository';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [SlackModule],
  controllers: [DeeplinkController],
  providers: [
    DeeplinkService,
    { provide: DEEPLINK_REPOSITORY, useClass: UpstashDeeplinkRepository },
  ],
})
export class DeeplinkModule {}
