import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global() // 전역 모듈로 설정 - 다른 모듈에서 import 없이 사용 가능
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
