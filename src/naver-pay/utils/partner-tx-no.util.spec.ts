import { describe, it, expect } from 'vitest';
import { generatePartnerTxNo } from './partner-tx-no.util';

describe('generatePartnerTxNo', () => {
  it('30자 이하의 문자열을 반환한다', () => {
    const txNo = generatePartnerTxNo();
    expect(txNo.length).toBeLessThanOrEqual(30);
  });

  it('제휴사코드(PAWPTE)를 포함한다', () => {
    const txNo = generatePartnerTxNo();
    expect(txNo).toContain('PAWPTE');
  });

  it('yyMMddHHmmss 형식의 날짜 접두사로 시작한다', () => {
    const txNo = generatePartnerTxNo();
    // 앞 12자리가 숫자
    const datePrefix = txNo.slice(0, 12);
    expect(datePrefix).toMatch(/^\d{12}$/);
  });

  it('매번 다른 값을 생성한다', () => {
    const txNo1 = generatePartnerTxNo();
    const txNo2 = generatePartnerTxNo();
    expect(txNo1).not.toBe(txNo2);
  });

  it('영문과 숫자로만 구성된다', () => {
    const txNo = generatePartnerTxNo();
    expect(txNo).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
