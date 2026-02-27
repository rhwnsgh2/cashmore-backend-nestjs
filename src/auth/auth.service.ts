import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { SupabaseService } from '../supabase/supabase.service';

interface UserIdResult {
  id: string;
}

@Injectable()
export class AuthService {
  // 토큰 → userId 캐시 (토큰 갱신 시 자동으로 새 캐시 엔트리 생성)
  private userIdCache: LRUCache<string, string>;

  constructor(private supabaseService: SupabaseService) {
    this.userIdCache = new LRUCache<string, string>({
      max: 100000,
      ttl: 1000 * 60 * 60, // 1시간 (토큰 갱신 주기가 하루이므로 여유있게)
    });
  }

  async getUserIdByToken(
    token: string,
    authId: string,
  ): Promise<string | null> {
    const cached = this.userIdCache.get(token);
    if (cached) {
      return cached;
    }

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user')
      .select('id')
      .eq('auth_id', authId)
      .single<UserIdResult>();

    if (error || !data) {
      return null;
    }

    this.userIdCache.set(token, data.id);
    return data.id;
  }

  async getUserIdByAuthId(authId: string): Promise<string | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user')
      .select('id')
      .eq('auth_id', authId)
      .single<UserIdResult>();

    if (error || !data) {
      return null;
    }

    return data.id;
  }
}
