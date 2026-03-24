import * as crypto from 'crypto';
import { DAOU_CONFIG } from '../naver-pay.config';

const ALGORITHM = 'aes-256-cbc';

function getKeyAndIv(): { key: Buffer; iv: Buffer } {
  const key = Buffer.from(DAOU_CONFIG.encKey, 'utf8');
  const iv = Buffer.from(DAOU_CONFIG.encKey.substring(0, 16), 'utf8');
  return { key, iv };
}

/**
 * AES/CBC/PKCS5Padding 암호화
 * 다우기술 API 요청 시 개인정보 파라미터 암호화에 사용
 */
export function encrypt(plainText: string): string {
  const { key, iv } = getKeyAndIv();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  return encrypted.toString('base64');
}

/**
 * AES/CBC/PKCS5Padding 복호화
 */
export function decrypt(encryptedText: string): string {
  const { key, iv } = getKeyAndIv();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
