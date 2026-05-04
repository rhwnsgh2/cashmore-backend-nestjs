import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserInfoService } from './user-info.service';
import { PhoneResponseDto, UpsertPhoneDto } from './dto/phone.dto';

@ApiTags('UserInfo')
@Controller('user-info')
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Get('phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 기프티콘 수신용 휴대전화번호 조회',
  })
  @ApiResponse({ status: 200, type: PhoneResponseDto })
  async getPhone(@CurrentUser('userId') userId: string): Promise<PhoneResponseDto> {
    const phone = await this.userInfoService.getPhone(userId);
    return { phone };
  }

  @Put('phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 기프티콘 수신용 휴대전화번호 등록/수정',
    description:
      '하이픈/공백은 자동 제거 후 저장. 한국 휴대폰 형식(01X-XXXX-XXXX) 외엔 400.',
  })
  @ApiResponse({ status: 200, type: PhoneResponseDto })
  async upsertPhone(
    @CurrentUser('userId') userId: string,
    @Body() body: UpsertPhoneDto,
  ): Promise<PhoneResponseDto> {
    const phone = await this.userInfoService.upsertPhone(userId, body.phone);
    return { phone };
  }
}
