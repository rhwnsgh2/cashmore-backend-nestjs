import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccountInfoService } from './account-info.service';
import {
  AccountInfoResponseDto,
  CreateAccountInfoRequestDto,
  CreateAccountInfoResponseDto,
} from './dto/account-info.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth';

@ApiTags('AccountInfo')
@Controller('account-info')
export class AccountInfoController {
  constructor(private readonly accountInfoService: AccountInfoService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '계좌 정보 조회' })
  @ApiResponse({ status: 200, type: AccountInfoResponseDto })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getAccountInfo(
    @CurrentUser('userId') userId: string,
  ): Promise<AccountInfoResponseDto | null> {
    return this.accountInfoService.getAccountInfo(userId);
  }

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '계좌 정보 등록' })
  @ApiResponse({ status: 200, type: CreateAccountInfoResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async createAccountInfo(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAccountInfoRequestDto,
  ): Promise<CreateAccountInfoResponseDto> {
    return this.accountInfoService.createAccountInfo(
      userId,
      dto.bank,
      dto.accountHolder,
      dto.accountNumber,
    );
  }
}
