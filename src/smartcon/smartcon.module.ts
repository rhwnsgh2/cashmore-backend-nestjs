import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SupabaseModule } from '../supabase/supabase.module';
import { StorageModule } from '../storage/storage.module';
import { SmartconApiService } from './smartcon-api.service';
import { SmartconService } from './smartcon.service';
import { SMARTCON_GOODS_REPOSITORY } from './interfaces/smartcon-goods-repository.interface';
import { SupabaseSmartconGoodsRepository } from './repositories/supabase-smartcon-goods.repository';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000 }),
    SupabaseModule,
    StorageModule,
  ],
  providers: [
    SmartconApiService,
    SmartconService,
    {
      provide: SMARTCON_GOODS_REPOSITORY,
      useClass: SupabaseSmartconGoodsRepository,
    },
  ],
  exports: [SmartconApiService, SmartconService, SMARTCON_GOODS_REPOSITORY],
})
export class SmartconModule {}
