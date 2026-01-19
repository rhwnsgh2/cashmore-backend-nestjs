import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { GetMonthlyCalendarResponseDto } from './dto/get-monthly-calendar.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '월별 캘린더 조회',
    description: '해당 월의 일별 영수증 제출 개수와 획득 포인트를 조회합니다.',
  })
  @ApiQuery({
    name: 'month',
    required: true,
    description: '조회할 연월 (YYYY-MM 형식)',
    example: '2026-01',
  })
  @ApiResponse({
    status: 200,
    description: '캘린더 조회 성공',
    type: GetMonthlyCalendarResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getMonthlyCalendar(
    @CurrentUser('userId') userId: string,
    @Query('month') month: string,
  ): Promise<GetMonthlyCalendarResponseDto> {
    return this.calendarService.getMonthlyCalendar(userId, month);
  }
}
