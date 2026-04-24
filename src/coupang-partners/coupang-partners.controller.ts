import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CoupangPartnersService } from './coupang-partners.service';
import {
  CoupangPostbackRequestDto,
  CoupangPostbackResponseDto,
} from './dto/coupang-postback.dto';

@ApiTags('Coupang Partners')
@Controller('coupang')
export class CoupangPartnersController {
  private readonly logger = new Logger(CoupangPartnersController.name);

  constructor(
    private readonly coupangPartnersService: CoupangPartnersService,
  ) {}

  @Post('postback')
  @HttpCode(200)
  @SkipThrottle()
  @ApiOperation({ summary: '쿠팡 포스트백 수신' })
  @ApiResponse({ status: 200, type: CoupangPostbackResponseDto })
  async receivePostback(
    @Body() dto: CoupangPostbackRequestDto,
    @Req() req: Request,
  ): Promise<CoupangPostbackResponseDto> {
    try {
      const rawData =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : null;
      return await this.coupangPartnersService.handlePostback(dto, rawData);
    } catch (error) {
      this.logger.error('Postback processing failed', error?.stack);
      return { result: 'E', message: 'Internal server error' };
    }
  }
}
