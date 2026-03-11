import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IInvitationRepository,
  Invitation,
} from '../interfaces/invitation-repository.interface';
import { generateUniqueCode } from '../utils/generate-code';

interface InvitationRow {
  id: number;
  sender_id: string;
  created_at: string;
  identifier: string;
  type: 'default' | 'normal';
  status: 'pending' | 'used';
}

@Injectable()
export class SupabaseInvitationRepository implements IInvitationRepository {
  constructor(private supabaseService: SupabaseService) {}

  async createOrGetInvitation(
    userId: string,
    type: 'default' | 'normal' = 'normal',
  ): Promise<Invitation> {
    const client = this.supabaseService.getClient();

    // 기존 초대장 조회
    const { data: existing, error: fetchError } = await client
      .from('invitation')
      .select('id, sender_id, created_at, identifier, status')
      .eq('sender_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: true })
      .limit(1)
      .returns<InvitationRow[]>();

    // 초대장이 이미 있으면 반환 (원본과 동일: fetchError 없고 데이터 있을 때)
    if (!fetchError && existing && existing.length > 0) {
      return {
        id: existing[0].id,
        senderId: existing[0].sender_id,
        createdAt: existing[0].created_at,
        identifier: existing[0].identifier,
        type,
        status: existing[0].status,
      };
    }

    // 없으면 새로 생성
    const identifier = generateUniqueCode();
    const { data: created, error: insertError } = await client
      .from('invitation')
      .insert({
        sender_id: userId,
        identifier,
        status: 'pending',
        type,
      } as any)
      .select('id, sender_id, created_at, identifier, status')
      .single<InvitationRow>();

    if (insertError) {
      throw insertError;
    }

    return {
      id: created.id,
      senderId: created.sender_id,
      createdAt: created.created_at,
      identifier: created.identifier,
      type,
      status: created.status,
    };
  }
}
