import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdvertiserAuthService } from './advertiser-auth.service';
import {
  AdvertiserLoginDto,
  AdvertiserLoginResponseDto,
} from './dto/advertiser-login.dto';

@ApiTags('AdvertiserAuth')
@Controller('advertiser-auth')
export class AdvertiserAuthController {
  constructor(private advertiserAuthService: AdvertiserAuthService) {}

  @Post('login')
  @ApiOperation({
    summary: '광고주 로그인',
    description:
      '광고주 ID와 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.',
  })
  @ApiResponse({
    status: 201,
    description: '로그인 성공',
    type: AdvertiserLoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '로그인 실패 (ID 또는 비밀번호 불일치)' })
  async login(
    @Body() dto: AdvertiserLoginDto,
  ): Promise<AdvertiserLoginResponseDto> {
    return this.advertiserAuthService.login(dto.loginId, dto.password);
  }
}
