import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceDto } from './dto/get-attendances.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Attendance')
@Controller('attendances')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '출석 기록 조회',
    description: '사용자의 출석 기록과 관련 포인트 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '출석 기록 조회 성공',
    type: [AttendanceDto],
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getAttendances(
    @CurrentUser('userId') userId: string,
  ): Promise<AttendanceDto[]> {
    return this.attendanceService.getAttendances(userId);
  }
}
