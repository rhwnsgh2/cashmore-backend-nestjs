import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
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
  CreateExchangeRequestDto,
  CreateExchangeResponseDto,
  ExchangeListResponseDto,
  ExchangeConfigResponseDto,
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
      '네이버 로그인 uniqueId를 사용하여 네이버페이 계정을 연결합니다.\n\n' +
      '**성공 시**: `{ success: true, data: { maskingId, naverPayPoint } }`\n\n' +
      '**실패 시 (200)**: `{ success: false, errorCode, errorMessage }`\n\n' +
      '| errorCode | 원인 | 안내 메시지 |\n' +
      '|-----------|------|------------|\n' +
      '| 52004 | 네이버페이 미가입 | 네이버페이 가입 후 다시 시도해주세요 |\n' +
      '| 52001 | 네이버페이 계정 휴면 | 네이버페이 계정 상태를 확인해주세요 |\n' +
      '| 52002 | 네이버페이 계정 블랙 | 네이버페이 계정 상태를 확인해주세요 |\n\n' +
      '**400 에러**:\n' +
      '- 이미 연결된 계정이 있는 경우\n' +
      '- 일일 연결 시도 횟수(5회) 초과',
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
    description:
      '연결된 네이버페이 계정을 해제합니다.\n\n' +
      '- 진행 중인 전환 요청(pending)이 있으면 해제할 수 없습니다.\n' +
      '- 전환 요청을 먼저 취소한 후 해제해주세요.',
  })
  @ApiResponse({ status: 200, type: DisconnectNaverPayResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async disconnectAccount(
    @CurrentUser('userId') userId: string,
  ): Promise<DisconnectNaverPayResponseDto> {
    return this.naverPayService.disconnectAccount(userId);
  }

  // --- 포인트 전환 ---

  @Post('exchange')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '포인트 전환 요청',
    description:
      '캐시모어 포인트를 네이버페이 포인트로 전환 요청합니다.\n\n' +
      '- 요청 시 캐시모어 포인트가 즉시 차감됩니다.\n' +
      '- 전환 비율은 1:1.01 (캐시모어 1000P → 네이버페이 1010P)\n' +
      '- 최소 전환 금액: 1,000P\n' +
      '- 1일 1회만 요청 가능\n' +
      '- 요청 후 관리자 승인을 거쳐 네이버페이 포인트가 적립됩니다.\n' +
      '- 대기 중(pending)인 요청은 취소 가능하며, 취소 시 포인트가 복원됩니다.',
  })
  @ApiResponse({ status: 201, type: CreateExchangeResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async createExchange(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateExchangeRequestDto,
  ): Promise<CreateExchangeResponseDto> {
    return this.naverPayService.createExchange(userId, dto.point);
  }

  @Delete('exchange/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '포인트 전환 요청 취소',
    description:
      '대기 중(pending)인 전환 요청을 취소하고 캐시모어 포인트를 복원합니다.\n\n' +
      '- 본인의 요청만 취소 가능\n' +
      '- pending 상태만 취소 가능 (승인/완료/거절된 요청은 취소 불가)',
  })
  @ApiResponse({ status: 200, type: DisconnectNaverPayResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async cancelExchange(
    @CurrentUser('userId') userId: string,
    @Param('id') exchangeId: string,
  ): Promise<{ success: boolean }> {
    return this.naverPayService.cancelExchange(userId, exchangeId);
  }

  @Get('exchanges')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '전환 내역 조회',
    description:
      '사용자의 포인트 전환 요청 내역을 조회합니다.\n\n' +
      '- 상태: pending(대기중), approved(승인됨), completed(완료), failed(실패), cancelled(취소), rejected(거절)\n' +
      '- 실패/취소/거절된 요청은 캐시모어 포인트가 복원된 상태입니다.',
  })
  @ApiResponse({ status: 200, type: ExchangeListResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getExchanges(
    @CurrentUser('userId') userId: string,
  ): Promise<ExchangeListResponseDto> {
    return this.naverPayService.getExchanges(userId);
  }

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '전환 정책 조회',
    description:
      '전환 화면 진입 시 호출하여 현재 정책과 오늘 사용 현황을 조회합니다.\n\n' +
      '- exchangeRate: 전환 비율 (1.01이면 캐시모어 1000P → 네이버페이 1010P)\n' +
      '- minPoint: 최소 전환 가능 포인트\n' +
      '- dailyLimit: 하루 요청 가능 횟수\n' +
      '- todayUsed: 오늘 요청한 횟수 (todayUsed >= dailyLimit이면 요청 불가)',
  })
  @ApiResponse({ status: 200, type: ExchangeConfigResponseDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getExchangeConfig(
    @CurrentUser('userId') userId: string,
  ): Promise<ExchangeConfigResponseDto> {
    return this.naverPayService.getExchangeConfig(userId);
  }
}
