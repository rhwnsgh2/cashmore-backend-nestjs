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
    const parts = version.split('.');
    const majorMinor = parts.slice(0, 2).join('.');
    return { os: 'iOS', osVersion: majorMinor };
  }

  // Android: "Android 15" or "Android 14.0"
  const androidMatch = userAgent.match(/Android (\d+(?:\.\d+)?)/);
  if (androidMatch) {
    return { os: 'Android', osVersion: androidMatch[1] };
  }

  return { os: 'unknown', osVersion: 'unknown' };
}

/**
 * OS 버전을 비교 가능한 형식으로 정규화한다.
 * - Android: major만 ("15.0.0" → "15")
 * - iOS: major.minor ("18.3.1" → "18.3")
 */
export function normalizeVersion(os: string, version: string): string {
  const parts = version.split('.');
  if (os === 'Android') {
    return parts[0];
  }
  // iOS: major.minor
  return parts.slice(0, 2).join('.');
}

export interface ClickSignals {
  os: string;
  osVersion: string;
  screenWidth?: number;
  screenHeight?: number;
  model?: string;
}

export interface MatchSignals {
  os: string;
  osVersion: string;
  screenWidth?: number;
  screenHeight?: number;
  model?: string;
}

export interface ScoreResult {
  matched: boolean;
  score: number;
  details: string[];
}

/**
 * 클릭 시그널과 매칭 시그널을 비교하여 점수를 산출한다.
 *
 * 규칙:
 * - Required: OS가 일치해야 한다 (불일치 시 즉시 실패)
 * - 추가 시그널(screenWidth+Height, osVersion major, model)이 양쪽 모두 있을 때:
 *   - 일치 시 점수 가산, 불일치 시 패널티 없음 (단, 모두 불일치면 실패)
 * - 추가 시그널이 한쪽에만 있거나 양쪽 모두 없으면: IP + OS만으로 매칭
 */
export function scoreMatch(
  click: ClickSignals,
  match: MatchSignals,
): ScoreResult {
  const details: string[] = [];

  // OS must match (required)
  if (click.os.toLowerCase() !== match.os.toLowerCase()) {
    return { matched: false, score: 0, details: ['OS mismatch'] };
  }
  details.push(`OS match: ${click.os}`);

  let score = 0;
  let comparableSignals = 0;
  let matchedSignals = 0;

  // Screen size comparison (both width and height must be present on both sides)
  const clickHasScreen =
    click.screenWidth != null && click.screenHeight != null;
  const matchHasScreen =
    match.screenWidth != null && match.screenHeight != null;
  const SCREEN_TOLERANCE = 2;
  if (clickHasScreen && matchHasScreen) {
    comparableSignals++;
    if (
      Math.abs(click.screenWidth! - match.screenWidth!) <= SCREEN_TOLERANCE &&
      Math.abs(click.screenHeight! - match.screenHeight!) <= SCREEN_TOLERANCE
    ) {
      score += 2;
      matchedSignals++;
      details.push(`Screen match: ${click.screenWidth}x${click.screenHeight}`);
    } else {
      details.push(
        `Screen mismatch: click=${click.screenWidth}x${click.screenHeight}, match=${match.screenWidth}x${match.screenHeight}`,
      );
    }
  }

  // OS version comparison (normalized)
  const clickVersion = normalizeVersion(click.os, click.osVersion);
  const matchVersion = normalizeVersion(match.os, match.osVersion);
  if (
    clickVersion &&
    matchVersion &&
    clickVersion !== 'unknown' &&
    matchVersion !== 'unknown'
  ) {
    comparableSignals++;
    // Compare major only for scoring
    const clickMajor = clickVersion.split('.')[0];
    const matchMajor = matchVersion.split('.')[0];
    if (clickMajor === matchMajor) {
      score += 1;
      matchedSignals++;
      details.push(`Version major match: ${clickMajor}`);
    } else {
      details.push(
        `Version mismatch: click=${clickVersion}, match=${matchVersion}`,
      );
    }
  }

  // Model comparison
  if (click.model && match.model) {
    comparableSignals++;
    if (click.model.toLowerCase() === match.model.toLowerCase()) {
      score += 1;
      matchedSignals++;
      details.push(`Model match: ${click.model}`);
    } else {
      details.push(
        `Model mismatch: click=${click.model}, match=${match.model}`,
      );
    }
  }

  // Decision logic:
  // - If no comparable signals exist: IP + OS is enough (low confidence)
  // - If comparable signals exist: at least 1 must match
  if (comparableSignals === 0) {
    details.push(
      'No additional signals available, IP+OS only (low confidence)',
    );
    return { matched: true, score: 0, details };
  }

  if (matchedSignals >= 1) {
    return { matched: true, score, details };
  }

  // All comparable signals failed to match
  details.push('All additional signals mismatched');
  return { matched: false, score: 0, details };
}
