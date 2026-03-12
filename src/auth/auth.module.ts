import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthOnlyGuard } from './guards/jwt-auth-only.guard';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [AuthService, JwtAuthGuard, JwtAuthOnlyGuard],
  exports: [AuthService, JwtAuthGuard, JwtAuthOnlyGuard],
})
export class AuthModule {}
