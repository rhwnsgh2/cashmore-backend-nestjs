import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IpWhitelistGuard } from './guards/ip-whitelist.guard';
import { BuzzvilService } from './buzzvil.service';
import { GetAdsQueryDto } from './dto/get-ads.dto';
import { ParticipateRequestDto } from './dto/participate.dto';
import { PostbackBodyDto } from './dto/postback.dto';
import type { Request } from 'express';

@ApiTags('Buzzvil')
@Controller('buzzvil')
export class BuzzvilController {
  constructor(private buzzvilService: BuzzvilService) {}

  @Get('ads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '광고 할당 요청 (S2S)' })
  @ApiResponse({ status: 200, description: 'Buzzvil 광고 목록' })
  async getAds(
    @CurrentUser('authId') authId: string,
    @Query() query: GetAdsQueryDto,
    @Req() req: Request,
  ) {
    const clientIp = req.ip!;
    return this.buzzvilService.getAds(authId, clientIp, query);
  }

  @Post('participate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '액션형 광고 참여 요청 (S2S)' })
  @ApiResponse({
    status: 201,
    description: '참여 정보 (landing_url, action_description 등)',
  })
  async participate(
    @CurrentUser('authId') authId: string,
    @Body() dto: ParticipateRequestDto,
    @Req() req: Request,
  ) {
    const clientIp = req.ip!;
    return this.buzzvilService.participate(authId, clientIp, dto);
  }

  @Post('postback')
  @UseGuards(IpWhitelistGuard)
  @HttpCode(200)
  @ApiOperation({ summary: '포스트백 수신 (Buzzvil → 서버)' })
  @ApiResponse({ status: 200, description: '적립 성공' })
  @ApiResponse({ status: 409, description: '이미 처리된 건' })
  async postback(@Body() dto: PostbackBodyDto) {
    return this.buzzvilService.handlePostback(dto);
  }

  @Get('reward-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '포인트 적립 확인 (폴링)' })
  @ApiResponse({ status: 200, description: '적립 상태' })
  async getRewardStatus(
    @CurrentUser('userId') userId: string,
    @Query('campaign_id') campaignId: string,
  ) {
    return this.buzzvilService.getRewardStatus(userId, Number(campaignId));
  }
}
