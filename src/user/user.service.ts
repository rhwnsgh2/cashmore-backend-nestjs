import { Inject, Injectable } from '@nestjs/common';
import type {
  IUserRepository,
  UserRole,
  UserProvider,
} from './interfaces/user-repository.interface';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';

export interface UserInfoResponse {
  id: string;
  email: string;
  role: UserRole;
  provider: UserProvider;
  createdAt: string;
  isBanned: boolean;
  banReason: string | null;
  marketingAgreement: boolean;
  nickname: string;
}

// 닉네임 자동 생성
function generateNickname(): string {
  const adjectives = [
    '행복한',
    '즐거운',
    '신나는',
    '활기찬',
    '밝은',
    '따뜻한',
    '귀여운',
    '멋진',
    '용감한',
    '지혜로운',
  ];
  const nouns = [
    '고양이',
    '강아지',
    '토끼',
    '펭귄',
    '다람쥐',
    '판다',
    '코알라',
    '여우',
    '사자',
    '호랑이',
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);

  return `${adjective}${noun}${number}`;
}

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private userRepository: IUserRepository,
  ) {}

  async getUserInfo(userId: string): Promise<UserInfoResponse | null> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return null;
    }

    // 닉네임이 없으면 자동 생성 후 업데이트
    let nickname = user.nickname;
    if (!nickname) {
      nickname = generateNickname();
      await this.userRepository.updateNickname(userId, nickname);
    }

    // 차단 여부 확인
    let isBanned = false;
    let banReason: string | null = null;

    if (user.is_banned) {
      banReason = await this.userRepository.findBanReason(user.auth_id);
      isBanned = banReason !== null;
    }

    return {
      id: user.id,
      email: user.email ?? '',
      role: 'user',
      provider: user.provider,
      createdAt: user.created_at,
      isBanned,
      banReason,
      marketingAgreement: user.marketing_info,
      nickname,
    };
  }
}
