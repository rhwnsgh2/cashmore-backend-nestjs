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
import { ExchangePointService } from './exchange-point.service';
import {
  ExchangePointRequestDto,
  ExchangePointResponseDto,
  ExchangePointSuccessDto,
  CancelExchangePointRequestDto,
} from './dto/exchange-point.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ExchangePoint')
@Controller('exchange-point-to-cash')
export class ExchangePointController {
  constructor(private exchangePointService: ExchangePointService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '출금 신청 내역 조회',
    description: '사용자의 포인트 출금 신청 내역을 조회합니다.',
  })
  @ApiResponse({ status: 200, type: [ExchangePointResponseDto] })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getExchangeHistory(
    @CurrentUser('userId') userId: string,
  ): Promise<ExchangePointResponseDto[]> {
    return this.exchangePointService.getExchangeHistory(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '포인트 출금 신청',
    description: '포인트를 현금으로 출금 신청합니다. 최소 1000 포인트.',
  })
  @ApiResponse({ status: 201, type: ExchangePointSuccessDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async requestExchange(
    @CurrentUser('userId') userId: string,
    @Body() dto: ExchangePointRequestDto,
  ): Promise<ExchangePointSuccessDto> {
    return this.exchangePointService.requestExchange(userId, dto.amount);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '출금 신청 취소',
    description: 'pending 상태의 출금 신청을 취소합니다.',
  })
  @ApiResponse({ status: 200, type: ExchangePointSuccessDto })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async cancelExchange(
    @CurrentUser('userId') userId: string,
    @Body() dto: CancelExchangePointRequestDto,
  ): Promise<{ success: boolean }> {
    return this.exchangePointService.cancelExchange(userId, dto.id);
  }
}
