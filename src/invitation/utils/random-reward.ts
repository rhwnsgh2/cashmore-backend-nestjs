/**
 * 초대 보상 랜덤 포인트 계산
 * 300(74%) / 500(20%) / 1000(4.9%) / 3000(1%) / 50000(0.1%)
 */
export function getRandomRewardPoint(): number {
  const random = Math.random() * 100;

  if (random < 74) return 300;
  if (random < 94) return 500;
  if (random < 98.9) return 1000;
  if (random < 99.9) return 3000;
  return 50000;
}
