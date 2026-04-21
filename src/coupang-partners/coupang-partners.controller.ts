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
    @Req() req: Request,
    @Body() dto: CoupangPostbackRequestDto,
  ): Promise<CoupangPostbackResponseDto> {
    try {
      return await this.coupangPartnersService.handlePostback(
        dto,
        req.body as Record<string, unknown>,
      );
    } catch (error) {
      this.logger.error(
        `Postback processing failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { result: 'E', message: 'Internal server error' };
    }
  }
}
