import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DeeplinkService } from './deeplink.service';
import { ClickRequestDto } from './dto/click.dto';
import { MatchRequestDto } from './dto/match.dto';

@ApiTags('Deeplink')
@Controller('deeplinks')
export class DeeplinkController {
  private readonly logger = new Logger(DeeplinkController.name);

  constructor(private deeplinkService: DeeplinkService) {}

  @Post('click')
  @HttpCode(200)
  @ApiOperation({ summary: '웹 클릭 fingerprint 저장' })
  @ApiResponse({ status: 200, description: '클릭 기록 완료' })
  async click(@Body() dto: ClickRequestDto, @Req() req: Request) {
    const ip = req.ip!;
    const userAgent = dto.userAgent;

    this.logger.log(`Click request: ip=${ip}, path=${dto.path}`);

    return this.deeplinkService.recordClick(ip, userAgent, dto);
  }

  @Post('match')
  @HttpCode(200)
  @ApiOperation({ summary: '앱 첫 실행 fingerprint 매칭' })
  @ApiResponse({ status: 200, description: '매칭 결과' })
  async match(@Body() dto: MatchRequestDto, @Req() req: Request) {
    const ip = req.ip!;

    this.logger.log(`Match request: ip=${ip}, os=${dto.os} ${dto.osVersion}`);

    return this.deeplinkService.matchFingerprint(ip, dto);
  }
}
