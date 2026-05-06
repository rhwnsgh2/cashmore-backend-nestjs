import { randomBytes } from 'crypto';

/**
 * 스마트콘 TR_ID 생성.
 * 형식: 'cashmore' + YYYYMMDDHHmmssSSS + 랜덤4(hex) = 29자 (50자 제한 내).
 */
export function generateTrId(now: Date = new Date()): string {
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('');
  const random = randomBytes(2).toString('hex'); // 4 hex chars
  return `cashmore${ts}${random}`;
}
