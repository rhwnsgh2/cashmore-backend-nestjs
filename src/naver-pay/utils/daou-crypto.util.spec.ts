import { encrypt, decrypt } from './daou-crypto.util';

describe('DaouCryptoUtil', () => {
  it('암호화된 문자열은 원본과 다르다', () => {
    const plainText = 'test-unique-id-12345';
    const encrypted = encrypt(plainText);

    expect(encrypted).not.toBe(plainText);
  });

  it('암호화 결과는 Base64 형식이다', () => {
    const encrypted = encrypt('test-value');
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;

    expect(base64Regex.test(encrypted)).toBe(true);
  });

  it('암호화 후 복호화하면 원본과 동일하다', () => {
    const plainText = 'test-unique-id-12345';
    const encrypted = encrypt(plainText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plainText);
  });

  it('한글 문자열도 암호화/복호화가 정상 동작한다', () => {
    const plainText = '테스트유저아이디';
    const encrypted = encrypt(plainText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plainText);
  });

  it('빈 문자열도 암호화/복호화가 정상 동작한다', () => {
    const plainText = '';
    const encrypted = encrypt(plainText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plainText);
  });

  it('같은 입력에 대해 같은 암호화 결과가 나온다 (CBC + 고정 IV)', () => {
    const plainText = 'consistent-input';
    const encrypted1 = encrypt(plainText);
    const encrypted2 = encrypt(plainText);

    expect(encrypted1).toBe(encrypted2);
  });

  it('다른 입력에 대해 다른 암호화 결과가 나온다', () => {
    const encrypted1 = encrypt('input-1');
    const encrypted2 = encrypt('input-2');

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('잘못된 Base64 입력으로 복호화 시 에러가 발생한다', () => {
    expect(() => decrypt('invalid-not-base64!@#')).toThrow();
  });
});
