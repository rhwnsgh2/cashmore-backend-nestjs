import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoupangService } from './coupang.service';
import { GoldBoxResponseDto } from './dto/goldbox-product.dto';
import {
  CoupangVisitResponseDto,
  CoupangVisitTodayResponseDto,
  CoupangVisitStatusResponseDto,
} from './dto/coupang-visit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth';

@ApiTags('Coupang')
@Controller('coupang')
export class CoupangController {
  constructor(private readonly coupangService: CoupangService) {}

  @Get('goldbox')
  @ApiOperation({ summary: '쿠팡 골드박스 상품 조회' })
  @ApiResponse({ status: 200, type: GoldBoxResponseDto })
  async getGoldBoxProducts(): Promise<GoldBoxResponseDto> {
    const products = await this.coupangService.getGoldBoxProducts();
    return { products };
  }

  @Post('visit')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '쿠팡 방문 포인트 지급' })
  @ApiResponse({ status: 200, type: CoupangVisitResponseDto })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async recordVisit(
    @CurrentUser('userId') userId: string,
  ): Promise<CoupangVisitResponseDto> {
    return this.coupangService.recordVisit(userId);
  }

  @Get('visit/today')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '오늘 쿠팡 방문 보상 수령 여부',
    description: 'KST 자정 기준으로 오늘 쿠팡 방문 보상을 받았는지 반환합니다.',
  })
  @ApiResponse({ status: 200, type: CoupangVisitTodayResponseDto })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getTodayVisitStatus(
    @CurrentUser('userId') userId: string,
  ): Promise<CoupangVisitTodayResponseDto> {
    return this.coupangService.getTodayVisitStatus(userId);
  }

  @Post('v2/visit')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '쿠팡 방문 포인트 지급 (v2)',
    description: '마지막 방문으로부터 10시간이 경과한 경우 7P를 지급합니다.',
  })
  @ApiResponse({ status: 200, type: CoupangVisitResponseDto })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async recordVisitV2(
    @CurrentUser('userId') userId: string,
  ): Promise<CoupangVisitResponseDto> {
    return this.coupangService.recordVisitV2(userId);
  }

  @Get('v2/visit/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '쿠팡 방문 보상 쿨다운 상태 조회 (v2)',
    description:
      '마지막 방문 시각, 다음 방문 가능 시각, 남은 시간(초)을 반환합니다.',
  })
  @ApiResponse({ status: 200, type: CoupangVisitStatusResponseDto })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getVisitStatusV2(
    @CurrentUser('userId') userId: string,
  ): Promise<CoupangVisitStatusResponseDto> {
    return this.coupangService.getVisitStatusV2(userId);
  }
}
