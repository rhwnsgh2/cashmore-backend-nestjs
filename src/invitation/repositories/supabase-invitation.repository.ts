import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  EveryReceipt,
  IInvitationRepository,
  Invitation,
  StepRewardAction,
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
      })
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

  async getInvitationByCode(code: string): Promise<Invitation | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('invitation')
      .select('id, sender_id, created_at, identifier, type, status')
      .eq('identifier', code)
      .maybeSingle<InvitationRow>();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      senderId: data.sender_id,
      createdAt: data.created_at,
      identifier: data.identifier,
      type: data.type,
      status: data.status,
    };
  }

  async findInvitationIdByUserId(userId: string): Promise<number | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('invitation')
      .select('id')
      .eq('sender_id', userId)
      .eq('type', 'normal')
      .order('created_at', { ascending: true })
      .limit(1)
      .returns<{ id: number }[]>();

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].id;
  }

  async countInvitedUsersSince(
    invitationId: number,
    since: string,
  ): Promise<number> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('invitation_user')
      .select('id')
      .eq('invitation_id', invitationId)
      .gte('created_at', since)
      .returns<{ id: number }[]>();

    if (error || !data) {
      return 0;
    }

    return new Set(data.map((row) => row.id)).size;
  }

  async countInvitedUsersBetween(
    invitationId: number,
    startsAt: string,
    endsAt: string,
  ): Promise<number> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('invitation_user')
      .select('id')
      .eq('invitation_id', invitationId)
      .gte('created_at', startsAt)
      .lte('created_at', endsAt)
      .returns<{ id: number }[]>();

    if (error || !data) {
      return 0;
    }

    return new Set(data.map((row) => row.id)).size;
  }

  async countTotalInvitedUsers(invitationId: number): Promise<number> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('invitation_user')
      .select('id')
      .eq('invitation_id', invitationId)
      .returns<{ id: number }[]>();

    if (error || !data) {
      return 0;
    }

    return new Set(data.map((row) => row.id)).size;
  }

  async findStepRewards(userId: string): Promise<StepRewardAction[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('point_actions')
      .select('additional_data')
      .eq('type', 'INVITE_STEP_REWARD')
      .eq('user_id', userId)
      .is('additional_data->partner_program_id', null)
      .returns<{ additional_data: { step_count?: number } }[]>();

    if (error || !data) {
      return [];
    }

    return data
      .filter((row) => row.additional_data?.step_count)
      .map((row) => ({ stepCount: row.additional_data.step_count! }));
  }

  async hasStepReward(userId: string, stepCount: number): Promise<boolean> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('point_actions')
      .select('id')
      .eq('type', 'INVITE_STEP_REWARD')
      .eq('user_id', userId)
      .eq('additional_data->>step_count', String(stepCount))
      .is('additional_data->partner_program_id', null)
      .returns<{ id: number }[]>();

    if (error || !data) {
      return false;
    }

    return data.length > 0;
  }

  async findStepRewardsByProgram(
    userId: string,
    programId: number,
  ): Promise<StepRewardAction[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('point_actions')
      .select('additional_data')
      .eq('type', 'INVITE_STEP_REWARD')
      .eq('user_id', userId)
      .eq('additional_data->>partner_program_id', String(programId))
      .returns<{ additional_data: { step_count?: number } }[]>();

    if (error || !data) {
      return [];
    }

    return data
      .filter((row) => row.additional_data?.step_count)
      .map((row) => ({ stepCount: row.additional_data.step_count! }));
  }

  async hasStepRewardByProgram(
    userId: string,
    stepCount: number,
    programId: number,
  ): Promise<boolean> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('point_actions')
      .select('id')
      .eq('type', 'INVITE_STEP_REWARD')
      .eq('user_id', userId)
      .eq('additional_data->>step_count', String(stepCount))
      .eq('additional_data->>partner_program_id', String(programId))
      .returns<{ id: number }[]>();

    if (error || !data) {
      return false;
    }

    return data.length > 0;
  }

  // processInvitationReward 관련

  async findUserDeviceId(userId: string): Promise<string | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user')
      .select('device_id')
      .eq('id', userId)
      .maybeSingle<{ device_id: string | null }>();

    if (error || !data) {
      return null;
    }

    return data.device_id;
  }

  async findUserCreatedAt(userId: string): Promise<string | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user')
      .select('created_at')
      .eq('id', userId)
      .maybeSingle<{ created_at: string }>();

    if (error || !data) {
      return null;
    }

    return data.created_at;
  }

  async hasDeviceEventParticipation(
    deviceId: string,
    eventName: string,
  ): Promise<boolean> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('device_event_participation')
      .select('id')
      .eq('device_id', deviceId)
      .eq('event_name', eventName)
      .limit(1);

    if (error || !data) {
      return false;
    }

    return data.length > 0;
  }

  async createDeviceEventParticipation(
    deviceId: string,
    eventName: string,
    userId: string,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const { error } = await client.from('device_event_participation').insert({
      device_id: deviceId,
      event_name: eventName,
      user_id: userId,
    });

    if (error) {
      throw error;
    }
  }

  async hasInviteRewardForUser(
    senderId: string,
    invitedUserId: string,
  ): Promise<boolean> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('point_actions')
      .select('id')
      .eq('user_id', senderId)
      .eq('type', 'INVITE_REWARD')
      .eq('additional_data->>invited_user_id', invitedUserId)
      .limit(1);

    if (error || !data) {
      return false;
    }

    return data.length > 0;
  }

  async createInvitationUser(
    invitationId: number,
    userId: string,
    type: 'normal' | 'receipt' = 'normal',
    sourceReceiptId?: number,
  ): Promise<number> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('invitation_user')
      .insert({
        invitation_id: invitationId,
        user_id: userId,
        type,
        source_receipt_id: sourceReceiptId ?? null,
      })
      .select('id')
      .single<{ id: number }>();

    if (error) {
      throw error;
    }

    return data.id;
  }

  // 영수증 초대 통계

  async findTopInviters(
    minInviteCount: number,
  ): Promise<{ userId: string; email: string | null; inviteCount: number }[]> {
    const client = this.supabaseService.getClient();

    // 1) invitation_user를 invitation_id 기준으로 모두 불러와 메모리에서 집계
    const { data: invUsers, error: iuErr } = await client
      .from('invitation_user')
      .select('invitation_id')
      .returns<{ invitation_id: number | null }[]>();

    if (iuErr || !invUsers) return [];

    const invitationIdCount = new Map<number, number>();
    for (const row of invUsers) {
      if (row.invitation_id == null) continue;
      invitationIdCount.set(
        row.invitation_id,
        (invitationIdCount.get(row.invitation_id) ?? 0) + 1,
      );
    }

    if (invitationIdCount.size === 0) return [];

    // 2) invitation_id → sender_id 매핑
    const invitationIds = Array.from(invitationIdCount.keys());
    const { data: invs, error: iErr } = await client
      .from('invitation')
      .select('id, sender_id')
      .in('id', invitationIds)
      .returns<{ id: number; sender_id: string }[]>();

    if (iErr || !invs) return [];

    // sender_id별로 초대 수 합산 (한 유저가 여러 invitation row를 가질 수 있음)
    const senderCount = new Map<string, number>();
    for (const inv of invs) {
      const count = invitationIdCount.get(inv.id) ?? 0;
      senderCount.set(
        inv.sender_id,
        (senderCount.get(inv.sender_id) ?? 0) + count,
      );
    }

    const qualifiedSenders = Array.from(senderCount.entries()).filter(
      ([, count]) => count >= minInviteCount,
    );

    if (qualifiedSenders.length === 0) return [];

    // 3) email 조회
    const userIds = qualifiedSenders.map(([id]) => id);
    const { data: users, error: uErr } = await client
      .from('user')
      .select('id, email')
      .in('id', userIds)
      .returns<{ id: string; email: string | null }[]>();

    if (uErr || !users) return [];

    const emailMap = new Map(users.map((u) => [u.id, u.email]));

    return qualifiedSenders
      .map(([userId, inviteCount]) => ({
        userId,
        email: emailMap.get(userId) ?? null,
        inviteCount,
      }))
      .sort((a, b) => b.inviteCount - a.inviteCount);
  }

  async countInvitedUsersByReceiptId(receiptId: number): Promise<number> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('invitation_user')
      .select('id')
      .eq('source_receipt_id', receiptId)
      .returns<{ id: number }[]>();

    if (error || !data) {
      return 0;
    }

    return data.length;
  }

  // grantReceiptPoint 관련

  async findEveryReceiptById(receiptId: number): Promise<EveryReceipt | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('every_receipt')
      .select('id, user_id, point, status, image_url, score_data, created_at')
      .eq('id', receiptId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as unknown as EveryReceipt;
  }
}
