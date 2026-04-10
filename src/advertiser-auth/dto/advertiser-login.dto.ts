import { ApiProperty } from '@nestjs/swagger';

export class AdvertiserLoginDto {
  @ApiProperty({ description: '광고주 로그인 ID', example: 'acme_corp' })
  loginId: string;

  @ApiProperty({ description: '비밀번호', example: 'password123' })
  password: string;
}

export class AdvertiserLoginResponseDto {
  @ApiProperty({
    description: 'JWT 액세스 토큰',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  accessToken: string;

  @ApiProperty({ description: '광고주 회사명', example: '주식회사 캐시모어' })
  companyName: string;
}
