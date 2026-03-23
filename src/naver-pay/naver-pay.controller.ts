import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NaverPayService } from './naver-pay.service';
import {
  ConnectNaverPayRequestDto,
  NaverPayAccountConnectedResponseDto,
  ConnectNaverPaySuccessResponseDto,
  DisconnectNaverPayResponseDto,
} from './dto/naver-pay.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('NaverPay')
@Controller('naverpay')
export class NaverPayController {
  constructor(private naverPayService: NaverPayService) {}

  @Get('account')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '네이버페이 계정 연결 상태 조회',
    description: '현재 사용자의 네이버페이 계정 연결 상태를 조회합니다.',
  })
  @ApiResponse({ status: 200, type: NaverPayAccountConnectedResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getAccount(
    @CurrentUser('userId') userId: string,
  ): Promise<NaverPayAccountConnectedResponseDto> {
    return this.naverPayService.getAccount(userId);
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '네이버페이 계정 연결',
    description:
      '네이버 로그인 uniqueId를 사용하여 네이버페이 계정을 연결합니다.',
  })
  @ApiResponse({ status: 201, type: ConnectNaverPaySuccessResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async connectAccount(
    @CurrentUser('userId') userId: string,
    @Body() dto: ConnectNaverPayRequestDto,
  ): Promise<ConnectNaverPaySuccessResponseDto> {
    return this.naverPayService.connectAccount(userId, dto.uniqueId);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '네이버페이 계정 연결 해제',
    description: '연결된 네이버페이 계정을 해제합니다.',
  })
  @ApiResponse({ status: 200, type: DisconnectNaverPayResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async disconnectAccount(
    @CurrentUser('userId') userId: string,
  ): Promise<DisconnectNaverPayResponseDto> {
    return this.naverPayService.disconnectAccount(userId);
  }
}
