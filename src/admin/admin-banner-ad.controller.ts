import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BannerAdService } from '../banner-ad/banner-ad.service';
import {
  BannerAdStatsSummaryQueryDto,
  BannerAdStatsSummaryResponseDto,
} from '../banner-ad/dto/banner-ad-stats-summary.dto';

@ApiTags('Admin - BannerAd')
@Controller('admin/banner-ads')
export class AdminBannerAdController {
  constructor(
    private readonly bannerAdService: BannerAdService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: '배너 목록 조회 (관리자)' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, description: '배너 목록' })
  async getAllBannerAds(@Headers('x-admin-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
    return this.bannerAdService.getAllBannerAds();
  }

  @Patch(':id')
  @ApiOperation({ summary: '배너에 광고주 연결 (관리자)' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiParam({ name: 'id', description: '배너 광고 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        advertiserId: { type: 'number', example: 1 },
      },
      required: ['advertiserId'],
    },
  })
  @ApiResponse({ status: 200, description: '광고주 연결 성공' })
  async linkAdvertiser(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id', ParseIntPipe) bannerAdId: number,
    @Body() body: { advertiserId: number },
  ) {
    this.validateApiKey(apiKey);
    await this.bannerAdService.updateAdvertiserId(
      bannerAdId,
      body.advertiserId,
    );
    return { success: true };
  }

  @Get('stats/summary')
  @ApiOperation({ summary: '전체 광고 성과 요약 (관리자)' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({
    status: 200,
    description: '광고 성과 요약',
    type: BannerAdStatsSummaryResponseDto,
  })
  async getStatsSummary(
    @Headers('x-admin-api-key') apiKey: string,
    @Query() query: BannerAdStatsSummaryQueryDto,
  ): Promise<BannerAdStatsSummaryResponseDto> {
    this.validateApiKey(apiKey);
    return this.bannerAdService.getStatsSummary(query.startDate, query.endDate);
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
