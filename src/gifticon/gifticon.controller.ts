import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GifticonService } from './gifticon.service';
import { VisibleProductDto } from './dto/visible-product.dto';

@ApiTags('Gifticon')
@Controller('gifticon')
export class GifticonController {
  constructor(private readonly gifticonService: GifticonService) {}

  @Get('products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '노출 중인 기프티콘 상품 목록',
    description:
      '어드민이 노출 ON 한 활성 상품만 반환. 프론트에서 brand_name 기준으로 그룹핑.',
  })
  @ApiResponse({ status: 200, type: [VisibleProductDto] })
  async listProducts(): Promise<VisibleProductDto[]> {
    return this.gifticonService.listVisible();
  }
}
