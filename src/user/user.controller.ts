import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserInfoResponseDto } from './dto/get-user-info.dto';
import {
  CreateUserRequestDto,
  CreateUserResponseDto,
} from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthOnlyGuard } from '../auth/guards/jwt-auth-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('info')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'private, max-age=60')
  @Header('Vary', 'Authorization')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 정보 조회',
    description: '현재 로그인한 사용자의 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '사용자 정보 조회 성공',
    type: UserInfoResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  @ApiNotFoundResponse({
    description: '사용자를 찾을 수 없음',
  })
  async getUserInfo(
    @CurrentUser('userId') userId: string,
  ): Promise<UserInfoResponseDto> {
    const userInfo = await this.userService.getUserInfo(userId);

    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    return userInfo;
  }

  @Post()
  @UseGuards(JwtAuthOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '새 사용자 생성',
    description:
      '회원가입 시 새 사용자를 생성합니다. JWT 토큰의 auth_id를 기반으로 사용자를 생성합니다.',
  })
  @ApiBody({ type: CreateUserRequestDto })
  @ApiResponse({
    status: 201,
    description: '사용자 생성 성공',
    type: CreateUserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 유효하지 않음)',
  })
  @ApiConflictResponse({
    description: '이미 가입된 사용자',
  })
  async createUser(
    @CurrentUser() user: { authId: string; email: string },
    @Body() dto: CreateUserRequestDto,
  ): Promise<CreateUserResponseDto> {
    return this.userService.createUser({
      authId: user.authId,
      email: user.email,
      fcmToken: dto.fcmToken,
      marketingAgreement: dto.marketingAgreement,
      onboardingCompleted: dto.onboardingCompleted,
      deviceId: dto.deviceId,
      signupContext: dto.signupContext,
    });
  }
}
