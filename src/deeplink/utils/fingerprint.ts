import { createHash } from 'node:crypto';

/**
 * User-Agent에서 OS 이름과 버전을 파싱한다.
 */
export function parseUserAgent(userAgent: string): {
  os: string;
  osVersion: string;
} {
  // iOS: "iPhone OS 18_3_2" or "iPad"
  const iosMatch = userAgent.match(
    /(?:iPhone|iPad).*?OS (\d+[_\\.]\d+(?:[_\\.]\d+)?)/,
  );
  if (iosMatch) {
    const version = iosMatch[1].replace(/_/g, '.');
    return { os: 'iOS', osVersion: version };
  }

  // Android: "Android 15" or "Android 14.0"
  const androidMatch = userAgent.match(/Android (\d+(?:\.\d+)?)/);
  if (androidMatch) {
    return { os: 'Android', osVersion: androidMatch[1] };
  }

  return { os: 'unknown', osVersion: 'unknown' };
}

/**
 * IP + OS + OS 버전을 SHA256 해시로 변환한다.
 */
function hashFingerprint(ip: string, os: string, osVersion: string): string {
  return createHash('sha256').update(`${ip}:${os}:${osVersion}`).digest('hex');
}

/**
 * 웹 클릭 시: User-Agent에서 OS 정보를 파싱하여 fingerprint 해시를 생성한다.
 */
export function generateFingerprintFromUA(
  ip: string,
  userAgent: string,
): string {
  const { os, osVersion } = parseUserAgent(userAgent);
  return hashFingerprint(ip, os, osVersion);
}

/**
 * 앱 매칭 시: 앱에서 전달한 OS 정보로 fingerprint 해시를 생성한다.
 */
export function generateFingerprintFromApp(
  ip: string,
  os: string,
  osVersion: string,
): string {
  return hashFingerprint(ip, os, osVersion);
}
