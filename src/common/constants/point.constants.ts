/**
 * 포인트 소멸 기준 개월 수
 * 이 값을 변경하면 배치 소멸과 API 소멸 예정 포인트 계산이 모두 변경됩니다.
 *
 * - 배치(point-batch): baseDate 기준 (EXPIRATION_MONTHS + 1)개월 전 적립분 소멸
 * - API(point): 현재 기준 EXPIRATION_MONTHS개월 전까지 적립분으로 소멸 예정 계산
 */
export const POINT_EXPIRATION_MONTHS = 6;
