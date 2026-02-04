import { Module } from '@nestjs/common';
import { WatchedAdController } from './watched-ad.controller';
import { WatchedAdService } from './watched-ad.service';
import { WATCHED_AD_REPOSITORY } from './interfaces/watched-ad-repository.interface';
import { UpstashWatchedAdRepository } from './repositories/upstash-watched-ad.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WatchedAdController],
  providers: [
    WatchedAdService,
    {
      provide: WATCHED_AD_REPOSITORY,
      useClass: UpstashWatchedAdRepository,
    },
  ],
  exports: [WatchedAdService],
})
export class WatchedAdModule {}
