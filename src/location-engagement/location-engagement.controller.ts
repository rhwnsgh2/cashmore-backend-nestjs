import { Controller, Get, Header, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LocationEngagementService } from './location-engagement.service';
import { LocationEngagementResponseDto } from './dto/get-location-engagement.dto';

@ApiTags('Location Engagement')
@Controller('location-engagement')
export class LocationEngagementController {
  constructor(private service: LocationEngagementService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '위치 기반 참여율 랭킹 조회',
    description:
      '시군구별 참여율 증가율 기준 상위 100개 랭킹을 조회합니다.',
  })
  @ApiQuery({
    name: 'sigungu_code',
    required: false,
    description: '내 시군구 코드 (지정 시 myRanking 포함)',
  })
  @ApiResponse({
    status: 200,
    description: '랭킹 조회 성공',
    type: LocationEngagementResponseDto,
  })
  async getRankings(
    @Query('sigungu_code') sigunguCode?: string,
  ): Promise<LocationEngagementResponseDto> {
    return this.service.getRankings(sigunguCode);
  }
}
