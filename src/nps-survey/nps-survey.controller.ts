import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NpsSurveyService } from './nps-survey.service';
import { NpsSurveyTargetResponseDto } from './dto/nps-survey-target.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('NPS Survey')
@Controller('nps-survey')
export class NpsSurveyController {
  constructor(private npsSurveyService: NpsSurveyService) {}

  @Get('target')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'NPS 서베이 대상 여부 확인',
    description:
      '사용자가 NPS 서베이 대상인지 확인합니다. 출금 이력이 1000원 초과이고 오늘 출금하지 않은 경우 대상입니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'NPS 서베이 대상 여부',
    type: NpsSurveyTargetResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패',
  })
  async checkTarget(
    @CurrentUser('userId') userId: string,
  ): Promise<NpsSurveyTargetResponseDto> {
    return this.npsSurveyService.checkTarget(userId);
  }
}
