import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocalPromotionResponseDto } from './dto/local-promotion.dto';

@ApiTags('Local Promotion')
@Controller('local_promotion')
export class LocalPromotionController {
  @Get()
  @ApiOperation({ summary: '지역 프로모션 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '프로모션 목록',
    type: LocalPromotionResponseDto,
  })
  getLocalPromotions(): LocalPromotionResponseDto {
    return {
      promotions: [],
    };
  }
}
