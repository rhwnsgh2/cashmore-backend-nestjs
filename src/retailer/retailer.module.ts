import { Module } from '@nestjs/common';
import { RetailerController } from './retailer.controller';
import { RetailerService } from './retailer.service';
import { RETAILER_REPOSITORY } from './interfaces/retailer-repository.interface';
import { SupabaseRetailerRepository } from './repositories/supabase-retailer.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RetailerController],
  providers: [
    RetailerService,
    {
      provide: RETAILER_REPOSITORY,
      useClass: SupabaseRetailerRepository,
    },
  ],
  exports: [RetailerService],
})
export class RetailerModule {}
