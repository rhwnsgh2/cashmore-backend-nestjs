import {
  Controller,
  Delete,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
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
import { PointBatchService } from './point-batch.service';
import {
  AggregateResponseDto,
  ExpirePreviewResponseDto,
  ExpireResponseDto,
  MonthlyBatchResponseDto,
  RollbackExpireResponseDto,
} from './dto/monthly-batch-response.dto';

@ApiTags('Point Batch')
@Controller('point-batch')
export class PointBatchController {
  constructor(
    private batchService: PointBatchService,
    private configService: ConfigService,
  ) {}

  @Post('aggregate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '월별 적립 포인트 집계',
    description:
      '지난달 적립 포인트를 유저별로 집계하여 monthly_earned_points에 저장합니다.',
  })
  @ApiHeader({ name: 'x-batch-api-key', required: true })
  @ApiQuery({
    name: 'baseDate',
    required: false,
    description: '기준일 (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, type: AggregateResponseDto })
  async aggregate(
    @Headers('x-batch-api-key') apiKey: string,
    @Query('baseDate') baseDate?: string,
  ): Promise<AggregateResponseDto> {
    this.validateApiKey(apiKey);
    return this.batchService.aggregate(baseDate);
  }

  @Post('expire/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '포인트 소멸 미리보기',
    description:
      '소멸 대상 유저와 소멸 예정 포인트를 조회합니다. 실제 소멸은 실행하지 않습니다.',
  })
  @ApiHeader({ name: 'x-batch-api-key', required: true })
  @ApiQuery({
    name: 'baseDate',
    required: false,
    description: '기준일 (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, type: ExpirePreviewResponseDto })
  async expirePreview(
    @Headers('x-batch-api-key') apiKey: string,
    @Query('baseDate') baseDate?: string,
  ): Promise<ExpirePreviewResponseDto> {
    this.validateApiKey(apiKey);
    return this.batchService.expirePreview(baseDate);
  }

  @Post('expire')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '포인트 소멸 실행',
    description: '6개월 경과 포인트를 실제로 소멸시킵니다.',
  })
  @ApiHeader({ name: 'x-batch-api-key', required: true })
  @ApiQuery({
    name: 'baseDate',
    required: false,
    description: '기준일 (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, type: ExpireResponseDto })
  async expire(
    @Headers('x-batch-api-key') apiKey: string,
    @Query('baseDate') baseDate?: string,
  ): Promise<ExpireResponseDto> {
    this.validateApiKey(apiKey);
    return this.batchService.expire(baseDate);
  }

  @Post('monthly')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '월간 배치 전체 실행',
    description: '월별 적립 집계 + 포인트 소멸을 순차적으로 실행합니다.',
  })
  @ApiHeader({ name: 'x-batch-api-key', required: true })
  @ApiQuery({
    name: 'baseDate',
    required: false,
    description: '기준일 (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, type: MonthlyBatchResponseDto })
  async executeMonthlyBatch(
    @Headers('x-batch-api-key') apiKey: string,
    @Query('baseDate') baseDate?: string,
  ): Promise<MonthlyBatchResponseDto> {
    this.validateApiKey(apiKey);
    return this.batchService.executeMonthlyBatch(baseDate);
  }

  @Delete('expire/rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '포인트 소멸 롤백',
    description:
      '특정 소멸 기준월의 POINT_EXPIRATION 레코드를 삭제하여 소멸을 롤백합니다.',
  })
  @ApiHeader({ name: 'x-batch-api-key', required: true })
  @ApiQuery({
    name: 'expirationMonth',
    required: true,
    description: '소멸 기준월 (YYYY-MM)',
  })
  @ApiResponse({ status: 200, type: RollbackExpireResponseDto })
  async rollbackExpire(
    @Headers('x-batch-api-key') apiKey: string,
    @Query('expirationMonth') expirationMonth: string,
  ): Promise<RollbackExpireResponseDto> {
    this.validateApiKey(apiKey);
    return this.batchService.rollbackExpire(expirationMonth);
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid batch API key');
    }
  }
}
