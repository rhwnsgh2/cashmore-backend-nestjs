import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { SupabaseService } from '../supabase/supabase.service';

interface UserIdResult {
  id: string;
}

@Injectable()
export class AuthService {
  private userIdCache: LRUCache<string, string>;

  constructor(private supabaseService: SupabaseService) {
    this.userIdCache = new LRUCache<string, string>({
      max: 100000,
      ttl: 1000 * 60 * 60, // 1시간
    });
  }

  async getUserIdByAuthId(authId: string): Promise<string | null> {
    const cached = this.userIdCache.get(authId);
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

    this.userIdCache.set(authId, data.id);
    return data.id;
  }
}
