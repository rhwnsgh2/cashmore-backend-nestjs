import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdvertiserJwtAuthGuard } from '../advertiser-auth/guards/advertiser-jwt-auth.guard';
import { CurrentAdvertiser } from '../advertiser-auth/decorators/current-advertiser.decorator';
import { AdvertiserService } from './advertiser.service';
import {
  AdvertiserStatsQueryDto,
  AdvertiserStatsResponseDto,
} from './dto/advertiser-stats.dto';

@ApiTags('Advertiser')
@Controller('advertiser')
export class AdvertiserController {
  constructor(private advertiserService: AdvertiserService) {}

  @Get('stats')
  @UseGuards(AdvertiserJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '광고 통계 조회',
    description:
      '로그인한 광고주의 광고별 일별 노출/클릭/CTR 통계를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '광고 통계 목록',
    type: AdvertiserStatsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)' })
  async getStats(
    @CurrentAdvertiser('advertiserId') advertiserId: number,
    @Query() query: AdvertiserStatsQueryDto,
  ): Promise<AdvertiserStatsResponseDto> {
    return this.advertiserService.getStats(
      advertiserId,
      query.startDate,
      query.endDate,
    );
  }
}
