import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
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
import { CompleteOnboardingResponseDto } from './dto/complete-onboarding.dto';
import {
  UpdateNicknameRequestDto,
  UpdateNicknameResponseDto,
} from './dto/update-nickname.dto';
import {
  CheckNicknameRequestDto,
  CheckNicknameResponseDto,
} from './dto/check-nickname.dto';
import {
  UpdateMarketingRequestDto,
  UpdateMarketingResponseDto,
} from './dto/update-marketing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthOnlyGuard } from '../auth/guards/jwt-auth-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('last-used')
  @ApiOperation({
    summary: '마지막 사용 계정 provider 조회',
    description:
      'device_id로 해당 기기에서 포인트가 가장 많은 유저의 로그인 provider를 조회합니다.',
  })
  @ApiQuery({ name: 'device_id', required: true, description: '디바이스 ID' })
  @ApiResponse({ status: 200, description: 'provider 조회 성공' })
  async getLastUsed(
    @Query('device_id') deviceId?: string,
  ): Promise<{ provider: 'apple' | 'kakao' | null }> {
    if (!deviceId) {
      throw new BadRequestException('device_id is required');
    }
    return this.userService.getLastUsedProvider(deviceId);
  }

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

  @Delete('delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '회원 탈퇴',
    description: '현재 로그인한 사용자의 계정을 삭제합니다.',
  })
  @ApiResponse({ status: 200, description: '계정 삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async deleteUser(
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.userService.deleteUser(userId);
  }

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '온보딩 완료',
    description:
      '온보딩을 완료하고 포인트를 지급합니다. 이미 완료한 경우 실패를 반환합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '온보딩 완료 성공',
    type: CompleteOnboardingResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패',
  })
  async completeOnboarding(
    @CurrentUser('userId') userId: string,
  ): Promise<CompleteOnboardingResponseDto> {
    return this.userService.completeOnboarding(userId);
  }

  @Put('nickname')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '닉네임 변경',
    description:
      '현재 사용자의 닉네임을 변경합니다. 변경 이력은 nickname_history에 저장됩니다.',
  })
  @ApiBody({ type: UpdateNicknameRequestDto })
  @ApiResponse({
    status: 200,
    description: '닉네임 변경 성공',
    type: UpdateNicknameResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })
  @ApiConflictResponse({ description: '이미 사용 중인 닉네임' })
  async updateNickname(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateNicknameRequestDto,
  ): Promise<UpdateNicknameResponseDto> {
    return this.userService.updateNickname(userId, dto.nickname);
  }

  @Post('marketing')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '마케팅 정보 수신 동의 변경',
    description: '현재 사용자의 마케팅 정보 수신 동의 여부를 업데이트합니다.',
  })
  @ApiBody({ type: UpdateMarketingRequestDto })
  @ApiResponse({
    status: 200,
    description: '마케팅 동의 업데이트 성공',
    type: UpdateMarketingResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async updateMarketing(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMarketingRequestDto,
  ): Promise<UpdateMarketingResponseDto> {
    return this.userService.updateMarketingAgreement(
      userId,
      dto.marketingAgreement,
    );
  }

  @Post('nickname/check')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '닉네임 중복 확인',
    description:
      '닉네임이 다른 사용자에 의해 사용 중인지 확인합니다. 본인 닉네임은 제외됩니다.',
  })
  @ApiBody({ type: CheckNicknameRequestDto })
  @ApiResponse({
    status: 200,
    description: '중복 확인 결과',
    type: CheckNicknameResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async checkNicknameDuplicate(
    @CurrentUser('userId') userId: string,
    @Body() dto: CheckNicknameRequestDto,
  ): Promise<CheckNicknameResponseDto> {
    return this.userService.checkNicknameDuplicate(userId, dto.nickname);
  }
}
