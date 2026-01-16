import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: ReturnType<typeof createClient>;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('supabase.url');
    const serviceRoleKey = this.configService.get<string>(
      'supabase.serviceRoleKey',
    );

    if (!url || !serviceRoleKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.client = createClient(url, serviceRoleKey);
  }

  getClient() {
    return this.client;
  }
}
