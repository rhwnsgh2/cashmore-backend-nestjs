import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EventService } from './event.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Event')
@Controller('double-point-event')
export class DoublePointEventController {
  constructor(private eventService: EventService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '더블 포인트 이벤트 활성 여부 조회',
    description:
      '가입 다음날(KST 기준 00:00~23:59) 동안 더블 포인트 이벤트가 활성화되어 있는지 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '이벤트 활성 여부 (true/false)',
    type: Boolean,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getDoublePointStatus(
    @CurrentUser('userId') userId: string,
  ): Promise<boolean> {
    return this.eventService.isDoublePointActive(userId);
  }
}
