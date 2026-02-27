import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { BuzzvilController } from './buzzvil.controller';
import { BuzzvilService } from './buzzvil.service';
import { BuzzvilApiService } from './buzzvil-api.service';
import { BUZZVIL_REPOSITORY } from './interfaces/buzzvil-repository.interface';
import { SupabaseBuzzvilRepository } from './repositories/supabase-buzzvil.repository';

@Module({
  imports: [HttpModule.register({ timeout: 10000 }), AuthModule],
  controllers: [BuzzvilController],
  providers: [
    BuzzvilService,
    BuzzvilApiService,
    { provide: BUZZVIL_REPOSITORY, useClass: SupabaseBuzzvilRepository },
  ],
})
export class BuzzvilModule {}
