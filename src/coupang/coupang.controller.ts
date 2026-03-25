import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoupangService } from './coupang.service';
import { GoldBoxResponseDto } from './dto/goldbox-product.dto';

@ApiTags('Coupang')
@Controller('coupang')
export class CoupangController {
  constructor(private readonly coupangService: CoupangService) {}

  @Get('goldbox')
  @ApiOperation({ summary: '쿠팡 골드박스 상품 조회' })
  @ApiResponse({ status: 200, type: GoldBoxResponseDto })
  async getGoldBoxProducts(): Promise<GoldBoxResponseDto> {
    const products = await this.coupangService.getGoldBoxProducts();
    return { products };
  }
}
