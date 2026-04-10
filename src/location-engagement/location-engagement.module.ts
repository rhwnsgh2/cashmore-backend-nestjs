import { Module } from '@nestjs/common';
import { LocationEngagementController } from './location-engagement.controller';
import { LocationEngagementService } from './location-engagement.service';
import { LOCATION_ENGAGEMENT_REPOSITORY } from './interfaces/location-engagement-repository.interface';
import { SupabaseLocationEngagementRepository } from './repositories/supabase-location-engagement.repository';

@Module({
  controllers: [LocationEngagementController],
  providers: [
    LocationEngagementService,
    {
      provide: LOCATION_ENGAGEMENT_REPOSITORY,
      useClass: SupabaseLocationEngagementRepository,
    },
  ],
})
export class LocationEngagementModule {}
