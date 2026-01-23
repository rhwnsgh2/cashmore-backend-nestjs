import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdLotterySlotService } from './ad-lottery-slot.service';
import { SlotAvailabilityResponseDto } from './dto/check-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Lottery')
@Controller('lottery')
export class AdLotterySlotController {
  constructor(private adLotterySlotService: AdLotterySlotService) {}

  @Get('check-availability')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '광고 복권 시청 가능 여부 확인',
    description:
      '현재 슬롯에서 사용자가 광고를 시청할 수 있는지 확인합니다. 슬롯은 09:00, 13:00, 18:00, 22:00으로 나뉩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '시청 가능 여부 조회 성공',
    type: SlotAvailabilityResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async checkAvailability(
    @CurrentUser('userId') userId: string,
  ): Promise<SlotAvailabilityResponseDto> {
    return this.adLotterySlotService.checkAvailability(userId);
  }
}
