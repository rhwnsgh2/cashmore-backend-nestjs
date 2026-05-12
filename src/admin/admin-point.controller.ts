import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsUUID } from 'class-validator';
import { PointService } from '../point/point.service';
import { PointTotalResponseDto } from '../point/dto/get-point-total.dto';

class AdminPointQueryDto {
  @IsUUID()
  userId!: string;
}

@ApiTags('Admin - Point')
@Controller('admin/point')
export class AdminPointController {
  constructor(
    private readonly pointService: PointService,
    private readonly configService: ConfigService,
  ) {}

  @Get('total')
  @ApiOperation({
    summary: '유저의 총 포인트 조회 (어드민)',
    description:
      '임의 userId의 보유 포인트와 소멸 예정 포인트를 반환. 유저용 GET /point/total과 동일한 응답 형태.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'public.user.id (UUID)',
  })
  @ApiResponse({ status: 200, type: PointTotalResponseDto })
  async getPointTotal(
    @Headers('x-admin-api-key') apiKey: string,
    @Query() query: AdminPointQueryDto,
  ): Promise<PointTotalResponseDto> {
    this.validateApiKey(apiKey);
    return this.pointService.getPointTotal(query.userId);
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
