import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoupangService } from './coupang.service';
import { GoldBoxResponseDto } from './dto/goldbox-product.dto';
import { CoupangVisitResponseDto } from './dto/coupang-visit.dto';
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
}
