import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EventPointService } from './event-point.service';
import { EventPointDto } from './dto/get-event-points.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventPoint } from './interfaces/event-point-repository.interface';

@ApiTags('EventPoint')
@Controller('event-points')
export class EventPointController {
  constructor(private eventPointService: EventPointService) {}

  /**
   * @deprecated 쿠팡 오늘 방문 여부 확인용으로만 쓰이며, 신규 전용 엔드포인트로 대체 예정.
   * 현재는 최근 24시간 내 COUPANG_VISIT 액션만 반환한다.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Deprecated] 이벤트 포인트 목록 조회',
    description:
      '@deprecated 쿠팡 오늘 방문 여부 확인용. 최근 24시간 내 COUPANG_VISIT 액션만 최신순으로 반환합니다. 신규 전용 엔드포인트로 대체 예정.',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: '이벤트 포인트 목록 조회 성공',
    type: [EventPointDto],
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getEventPoints(
    @CurrentUser('userId') userId: string,
  ): Promise<EventPoint[]> {
    return this.eventPointService.getEventPoints(userId);
  }
}
