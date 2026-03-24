import { randomBytes } from 'crypto';
import { DAOU_CONFIG } from '../naver-pay.config';

/**
 * 다우기술 제휴사 거래 번호(partnerTxNo) 생성
 * 형식: yyMMddHHmmss + 제휴사코드 + 영문/숫자 조합 (30자 이하)
 */
export function generatePartnerTxNo(): string {
  const now = new Date();

  // Asia/Seoul (UTC+9)
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const yy = String(kst.getUTCFullYear()).slice(2);
  const MM = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const HH = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  const ss = String(kst.getUTCSeconds()).padStart(2, '0');

  const datePrefix = `${yy}${MM}${dd}${HH}${mm}${ss}`;
  const partnerCode = DAOU_CONFIG.partnerCode;

  // 남은 길이만큼 랜덤 영문/숫자
  const maxRandomLen = 30 - datePrefix.length - partnerCode.length;
  const randomSuffix = randomBytes(maxRandomLen)
    .toString('base64url')
    .slice(0, maxRandomLen);

  return `${datePrefix}${partnerCode}${randomSuffix}`;
}
