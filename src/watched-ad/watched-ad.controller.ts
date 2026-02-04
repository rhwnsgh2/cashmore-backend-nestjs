import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WatchedAdService } from './watched-ad.service';
import { WatchedAdSetResponseDto } from './dto/watched-ad-response.dto';

@ApiTags('WatchedAd')
@Controller('watched-ad-status')
export class WatchedAdController {
  constructor(private watchedAdService: WatchedAdService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '오늘 광고 시청 여부 조회' })
  @ApiResponse({
    status: 200,
    description: '광고 시청 여부 (true/false)',
    schema: { type: 'boolean' },
  })
  async getWatchedAdStatus(
    @CurrentUser() userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const watched = await this.watchedAdService.getWatchedAdStatus(userId);
    res.json(watched);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '광고 시청 완료 기록' })
  @ApiResponse({
    status: 201,
    description: '광고 시청 기록 성공',
    type: WatchedAdSetResponseDto,
  })
  async setWatchedAdStatus(
    @CurrentUser() userId: string,
  ): Promise<WatchedAdSetResponseDto> {
    return this.watchedAdService.setWatchedAdStatus(userId);
  }
}
