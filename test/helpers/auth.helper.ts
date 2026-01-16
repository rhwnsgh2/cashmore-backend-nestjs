import * as jwt from 'jsonwebtoken';

const TEST_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ??
  'super-secret-jwt-token-with-at-least-32-characters-long';

interface TokenPayload {
  sub: string;
  aud?: string;
  role?: string;
  email?: string;
}

/**
 * 테스트용 JWT 토큰 생성
 * @param authId - Supabase auth.users의 id (user 테이블의 auth_id와 매핑됨)
 * @param expiresIn - 토큰 만료 시간 (기본값: 1시간)
 */
export function generateTestToken(
  authId: string,
  expiresIn: string = '1h',
): string {
  const payload: TokenPayload = {
    sub: authId,
    aud: 'authenticated',
    role: 'authenticated',
  };

  return jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  });
}

/**
 * 만료된 테스트 토큰 생성
 */
export function generateExpiredToken(authId: string): string {
  const payload: TokenPayload = {
    sub: authId,
    aud: 'authenticated',
    role: 'authenticated',
  };

  return jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn: '-1h',
    algorithm: 'HS256',
  });
}

/**
 * 잘못된 secret으로 서명된 토큰 생성
 */
export function generateInvalidToken(authId: string): string {
  const payload: TokenPayload = {
    sub: authId,
    aud: 'authenticated',
    role: 'authenticated',
  };

  return jwt.sign(payload, 'wrong-secret', {
    expiresIn: '1h',
    algorithm: 'HS256',
  });
}
