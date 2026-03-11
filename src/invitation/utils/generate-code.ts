/**
 * 고유한 초대 코드 생성
 * 6자리 알파벳+숫자 조합 (헷갈리는 문자 제외: O, I, 1, 0)
 */
export function generateUniqueCode(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
