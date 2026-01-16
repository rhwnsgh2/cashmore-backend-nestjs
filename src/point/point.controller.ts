import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PointService } from './point.service';
import { PointTotalResponseDto } from './dto/get-point-total.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Point')
@Controller('point')
export class PointController {
  constructor(private pointService: PointService) {}

  @Get('total')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '총 포인트 조회',
    description: '사용자의 총 보유 포인트와 소멸 예정 포인트를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '포인트 조회 성공',
    type: PointTotalResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getPointTotal(
    @CurrentUser('userId') userId: string,
  ): Promise<PointTotalResponseDto> {
    return this.pointService.getPointTotal(userId);
  }
}
