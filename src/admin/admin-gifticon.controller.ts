import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { GifticonService } from '../gifticon/gifticon.service';
import {
  CatalogItemDto,
  CurationDto,
  CurationResponseDto,
} from '../gifticon/dto/curation.dto';

@ApiTags('Admin - Gifticon')
@Controller('admin/gifticon')
export class AdminGifticonController {
  constructor(
    private readonly gifticonService: GifticonService,
    private readonly configService: ConfigService,
  ) {}

  @Get('products')
  @ApiOperation({
    summary: '큐레이션 가능한 상품 목록 (smartcon_goods + 큐레이션 상태)',
    description:
      '단종된 상품도 포함되며 is_active 필드로 구분 가능. 큐레이션 안 된 상품은 id, point_price가 null.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiQuery({
    name: 'eventId',
    required: false,
    description: '미지정 시 SMARTCON_CONFIG.eventId 사용',
  })
  @ApiResponse({ status: 200, type: [CatalogItemDto] })
  async listCatalog(
    @Headers('x-admin-api-key') apiKey: string,
    @Query('eventId') eventId?: string,
  ): Promise<CatalogItemDto[]> {
    this.validateApiKey(apiKey);
    return this.gifticonService.listCatalogForAdmin(eventId);
  }

  @Put('products/:goodsId')
  @ApiOperation({
    summary: '상품 큐레이션 (point_price + is_visible UPSERT)',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiParam({ name: 'goodsId', description: '스마트콘 GOODS_ID' })
  @ApiResponse({ status: 200, type: CurationResponseDto })
  async upsertCuration(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('goodsId') goodsId: string,
    @Body() body: CurationDto,
  ): Promise<CurationResponseDto> {
    this.validateApiKey(apiKey);
    return this.gifticonService.curate({
      goods_id: goodsId,
      point_price: body.point_price,
      is_visible: body.is_visible,
    });
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
