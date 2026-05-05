import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/supabase/database.types';

const PUBLIC_KEY =
  `-----BEGIN PUBLIC KEY-----\n` +
  `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvgdFYpl4wWp+OvfwnKQ/\n` +
  `G76EXSJ/FnEkIlxzqJAGh9Gbz0geKcPAvPs2KhidCLxTASCGy0+3EGfIzlllBSCP\n` +
  `9Fvu3ptivLFhkuVjG/A0s++YWtb3nIYzdISuSKSvLkdrHIzVTy+vJfY0pLaTzsed\n` +
  `OmGwkT1MG+pGvsbTxVOpJvgSZUD2MxTBG8KiQa3pKzNujKowr5p56BlIZlRbgxDt\n` +
  `a3gzDWlccJO/MjloA8xj+ZCAaktJdjNZz5eAQwEGwdRsOZBb96zC6BG6/RVZylVw\n` +
  `GObEgDjEOheRSsVJOvzQsJ84BvURRfD35w/P/SjO3O+VXiSfAzMl8Ooy473JWolJ\n` +
  `GwIDAQAB\n` +
  `-----END PUBLIC KEY-----`;

export function encryptAccountNumber(accountNumber: string): string {
  return crypto
    .publicEncrypt(
      {
        key: PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      Buffer.from(accountNumber, 'utf-8'),
    )
    .toString('base64');
}

export interface TestAccountInfo {
  user_id: string;
  account_bank: string;
  account_number: string;
  account_user_name: string;
  display_number: string;
  created_at?: string;
}

export async function createAccountInfo(
  supabase: SupabaseClient<Database>,
  data: TestAccountInfo,
): Promise<void> {
  const { error } = await supabase.from('account_info').insert({
    user_id: data.user_id,
    account_bank: data.account_bank,
    account_number: data.account_number,
    account_user_name: data.account_user_name,
    display_number: data.display_number,
    ...(data.created_at ? { created_at: data.created_at } : {}),
  });

  if (error) {
    throw new Error(`Failed to create account info: ${error.message}`);
  }
}
