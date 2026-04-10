import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth';
import { BannerAdService } from './banner-ad.service';
import { BannerAdDto } from './dto/banner-ad-response.dto';
import { TrackEventResponseDto } from './dto/track-event-response.dto';

@ApiTags('BannerAd')
@Controller('banner-ads')
export class BannerAdController {
  constructor(private bannerAdService: BannerAdService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '활성 배너 광고 조회',
    description: '현재 활성화된 배너 광고 목록을 우선순위순으로 반환합니다.',
  })
  @ApiQuery({
    name: 'placement',
    required: false,
    description: '배너 위치 (기본값: main)',
    example: 'main',
  })
  @ApiResponse({
    status: 200,
    description: '활성 배너 목록',
    type: [BannerAdDto],
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getActiveBanners(
    @CurrentUser('userId') _userId: string,
    @Query('placement') placement = 'main',
  ): Promise<BannerAdDto[]> {
    return this.bannerAdService.getActiveBanners(placement);
  }

  @Post(':id/impression')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '배너 광고 노출 이벤트 기록',
    description: '배너가 화면에 50% 이상 노출되었을 때 호출합니다.',
  })
  @ApiParam({ name: 'id', description: '배너 광고 ID' })
  @ApiResponse({
    status: 201,
    description: '노출 이벤트 기록 성공',
    type: TrackEventResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async trackImpression(
    @Param('id', ParseIntPipe) adId: number,
    @CurrentUser('userId') userId: string,
  ): Promise<TrackEventResponseDto> {
    return this.bannerAdService.trackImpression(adId, userId);
  }

  @Post(':id/click')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '배너 광고 클릭 이벤트 기록',
    description: '사용자가 배너를 클릭했을 때 호출합니다.',
  })
  @ApiParam({ name: 'id', description: '배너 광고 ID' })
  @ApiResponse({
    status: 201,
    description: '클릭 이벤트 기록 성공',
    type: TrackEventResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async trackClick(
    @Param('id', ParseIntPipe) adId: number,
    @CurrentUser('userId') userId: string,
  ): Promise<TrackEventResponseDto> {
    return this.bannerAdService.trackClick(adId, userId);
  }
}
