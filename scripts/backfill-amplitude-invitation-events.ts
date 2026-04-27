/**
 * Amplitude 초대 보상 이벤트 백필 스크립트 (일회성)
 *
 * point_actions 테이블의 INVITE_REWARD / INVITED_USER_REWARD_RANDOM 행을 읽어
 * 다음 두 이벤트를 Amplitude /batch API로 발사한다.
 *  - invitation_reward_granted (sender)
 *  - invited_user_reward_received (invitee)
 *
 * 멱등성: insert_id를 point_action.id 기반으로 결정적으로 만들어 재실행 시 dedupe 됨.
 *
 * 사용법:
 *   AMPLITUDE_API_KEY=... SUPABASE_DB_URL=... \
 *     npx tsx scripts/backfill-amplitude-invitation-events.ts [--dry-run]
 */
import { Pool } from 'pg';

const DB_URL = process.env.SUPABASE_DB_URL;
const AMPLITUDE_API_KEY = process.env.AMPLITUDE_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;
const PAGE_SIZE = 5000;
const AMPLITUDE_ENDPOINT = 'https://api2.amplitude.com/batch';

if (!DB_URL) {
  console.error('SUPABASE_DB_URL is not set');
  process.exit(1);
}
if (!DRY_RUN && !AMPLITUDE_API_KEY) {
  console.error('AMPLITUDE_API_KEY is not set (use --dry-run to skip)');
  process.exit(1);
}

interface SenderRow {
  id: number;
  user_id: string;
  point_amount: number;
  created_at: string;
  invited_user_id: string | null;
  partner_program_id: string | null;
  receipt_bonus: number | null;
  signup_type: string | null;
}

interface InviteeRow {
  id: number;
  user_id: string;
  point_amount: number;
  created_at: string;
  signup_type: string | null;
  sender_was_partner: boolean;
}

interface AmplitudeEvent {
  user_id: string;
  event_type: string;
  time: number;
  insert_id: string;
  event_properties: Record<string, string | number | boolean | null>;
}

async function fetchSenderRows(
  pool: Pool,
  afterId: number,
): Promise<SenderRow[]> {
  const { rows } = await pool.query<SenderRow>(
    `
    SELECT
      pa.id,
      pa.user_id,
      pa.point_amount,
      pa.created_at,
      pa.additional_data->>'invited_user_id'    AS invited_user_id,
      pa.additional_data->>'partner_program_id' AS partner_program_id,
      (
        SELECT pa2.point_amount
        FROM point_actions pa2
        WHERE pa2.type = 'INVITATION_RECEIPT'
          AND pa2.user_id = pa.user_id
          AND pa2.additional_data->>'invited_user_id' = pa.additional_data->>'invited_user_id'
        LIMIT 1
      ) AS receipt_bonus,
      iu.type AS signup_type
    FROM point_actions pa
    LEFT JOIN invitation_user iu
      ON iu.user_id = (pa.additional_data->>'invited_user_id')::uuid
    WHERE pa.type = 'INVITE_REWARD'
      AND pa.id > $1
    ORDER BY pa.id
    LIMIT $2
    `,
    [afterId, PAGE_SIZE],
  );
  return rows;
}

async function fetchInviteeRows(
  pool: Pool,
  afterId: number,
): Promise<InviteeRow[]> {
  const { rows } = await pool.query<InviteeRow>(
    `
    SELECT
      pa.id,
      pa.user_id,
      pa.point_amount,
      pa.created_at,
      iu.type AS signup_type,
      (sender_invite.additional_data ? 'partner_program_id') AS sender_was_partner
    FROM point_actions pa
    LEFT JOIN invitation_user iu
      ON iu.id = (pa.additional_data->>'invitation_user_id')::int
    LEFT JOIN invitation inv
      ON inv.id = iu.invitation_id
    LEFT JOIN point_actions sender_invite
      ON sender_invite.user_id = inv.sender_id
     AND sender_invite.type = 'INVITE_REWARD'
     AND sender_invite.additional_data->>'invited_user_id' = pa.user_id::text
    WHERE pa.type = 'INVITED_USER_REWARD_RANDOM'
      AND pa.id > $1
    ORDER BY pa.id
    LIMIT $2
    `,
    [afterId, PAGE_SIZE],
  );
  return rows;
}

function buildSenderEvent(row: SenderRow): AmplitudeEvent {
  return {
    user_id: row.user_id,
    event_type: 'invitation_reward_granted',
    time: new Date(row.created_at).getTime(),
    insert_id: `backfill_invitation_reward_granted_${row.id}`,
    event_properties: {
      amount: row.point_amount,
      is_partner_bonus: row.partner_program_id !== null,
      signup_type: row.signup_type ?? 'normal',
      receipt_bonus: row.receipt_bonus ?? 0,
    },
  };
}

function buildInviteeEvent(row: InviteeRow): AmplitudeEvent {
  return {
    user_id: row.user_id,
    event_type: 'invited_user_reward_received',
    time: new Date(row.created_at).getTime(),
    insert_id: `backfill_invited_user_reward_received_${row.id}`,
    event_properties: {
      amount: row.point_amount,
      sender_was_partner: row.sender_was_partner === true,
      signup_type: row.signup_type ?? 'normal',
    },
  };
}

async function sendBatch(events: AmplitudeEvent[]): Promise<void> {
  if (DRY_RUN || events.length === 0) return;

  const res = await fetch(AMPLITUDE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: AMPLITUDE_API_KEY, events }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Amplitude /batch failed ${res.status}: ${body}`);
  }
}

async function processStream<TRow>(
  label: string,
  fetchPage: (afterId: number) => Promise<TRow[]>,
  toEvent: (row: TRow) => AmplitudeEvent,
  rowId: (row: TRow) => number,
): Promise<{ processed: number; sent: number }> {
  let afterId = 0;
  let processed = 0;
  let sent = 0;
  let buffer: AmplitudeEvent[] = [];

  for (;;) {
    const rows = await fetchPage(afterId);
    if (rows.length === 0) break;

    for (const row of rows) {
      buffer.push(toEvent(row));
      processed += 1;
      if (buffer.length >= BATCH_SIZE) {
        await sendBatch(buffer);
        sent += buffer.length;
        buffer = [];
      }
    }

    afterId = rowId(rows[rows.length - 1]);
    console.log(`  [${label}] processed=${processed} (last id=${afterId})`);
  }

  if (buffer.length > 0) {
    await sendBatch(buffer);
    sent += buffer.length;
  }

  return { processed, sent };
}

async function main(): Promise<void> {
  console.log(`\nMode: ${DRY_RUN ? 'DRY RUN (no Amplitude calls)' : 'LIVE'}`);
  console.log(`DB:   ${DB_URL?.replace(/\/\/.*@/, '//***@')}\n`);

  const pool = new Pool({ connectionString: DB_URL });

  try {
    console.log('▶ invitation_reward_granted (sender)');
    const sender = await processStream(
      'sender',
      (afterId) => fetchSenderRows(pool, afterId),
      buildSenderEvent,
      (row) => row.id,
    );
    console.log(
      `  done: processed=${sender.processed}, sent=${sender.sent}\n`,
    );

    console.log('▶ invited_user_reward_received (invitee)');
    const invitee = await processStream(
      'invitee',
      (afterId) => fetchInviteeRows(pool, afterId),
      buildInviteeEvent,
      (row) => row.id,
    );
    console.log(
      `  done: processed=${invitee.processed}, sent=${invitee.sent}\n`,
    );

    const total = sender.processed + invitee.processed;
    console.log(`Total events: ${total}`);
    if (DRY_RUN) {
      console.log('(dry-run: nothing was sent to Amplitude)');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
