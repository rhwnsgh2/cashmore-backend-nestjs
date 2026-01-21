import {
  Controller,
  Get,
  Header,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserInfoResponseDto } from './dto/get-user-info.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
