import { ApiProperty } from '@nestjs/swagger';

export class UserInfoResponseDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 'uuid-1234-5678',
  })
  id: string;

  @ApiProperty({
    description: '이메일',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: '역할',
    example: 'user',
    enum: ['admin', 'dev', 'user'],
  })
  role: string;

  @ApiProperty({
    description: '로그인 제공자',
    example: 'kakao',
    enum: ['apple', 'kakao', 'other'],
  })
  provider: string;

  @ApiProperty({
    description: '가입일',
    example: '2025-01-01T00:00:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: '차단 여부',
    example: false,
  })
  isBanned: boolean;

  @ApiProperty({
    description: '차단 사유',
    example: null,
    nullable: true,
  })
  banReason: string | null;

  @ApiProperty({
    description: '마케팅 동의 여부',
    example: true,
  })
  marketingAgreement: boolean;

  @ApiProperty({
    description: '닉네임',
    example: '행복한고양이123',
  })
  nickname: string;
}
