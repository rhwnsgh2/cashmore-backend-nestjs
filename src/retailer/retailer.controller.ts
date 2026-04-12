import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RetailerService } from './retailer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Retailer')
@Controller('retailers')
export class RetailerController {
  constructor(private retailerService: RetailerService) {}

  @Get('cashback')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '매장별 캐시백 비율 조회',
    description: '매장별 기본 캐시백 비율을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '캐시백 비율 조회 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getRetailersCashback() {
    return this.retailerService.getRetailersCashback();
  }

  @Get()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiOperation({
    summary: '매장 목록 조회',
    description: '가시 상태인 매장 목록을 썸네일 이미지와 함께 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '매장 목록 조회 성공' })
  async getRetailers() {
    return this.retailerService.getRetailers();
  }
}
