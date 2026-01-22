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

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '이벤트 포인트 목록 조회',
    description:
      '사용자의 이벤트 포인트 내역 (쿠팡 방문, 온보딩 이벤트, 제휴, 복권)을 최신순으로 조회합니다.',
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
