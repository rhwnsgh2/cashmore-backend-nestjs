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
import { DividendService } from './dividend.service';
import { SimulateDividendResponseDto } from './dto/simulate-dividend.dto';

const ADMIN_API_KEY = 'ohuuho0611^';

@ApiTags('Dividend')
@Controller('dividend')
export class DividendController {
  constructor(private dividendService: DividendService) {}

  @Get('simulate')
  @ApiOperation({
    summary: '배당 시뮬레이션 기초 데이터 조회',
    description:
      '특정 월의 영수증 유저 분포 데이터를 조회합니다. 배당 시뮬레이션의 기초 데이터로 사용됩니다.',
  })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiQuery({ name: 'year', required: true, description: '연도 (예: 2026)' })
  @ApiQuery({ name: 'month', required: true, description: '월 (예: 1~12)' })
  @ApiResponse({ status: 200, type: SimulateDividendResponseDto })
  async getSimulateData(
    @Headers('x-api-key') apiKey: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ): Promise<SimulateDividendResponseDto> {
    this.validateApiKey(apiKey);
    return this.dividendService.getSimulateData(year, month);
  }

  private validateApiKey(apiKey: string): void {
    if (!apiKey || apiKey !== ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
