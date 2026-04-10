import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AdvertiserAuthService } from '../advertiser-auth/advertiser-auth.service';

@ApiTags('Admin - Advertiser')
@Controller('admin/advertisers')
export class AdminAdvertiserController {
  constructor(
    private readonly advertiserAuthService: AdvertiserAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: '광고주 전체 목록 조회 (관리자)' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({
    status: 200,
    description: '광고주 목록',
  })
  async listAdvertisers(@Headers('x-admin-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
    return this.advertiserAuthService.findAllAdvertisers();
  }

  @Post()
  @ApiOperation({ summary: '광고주 계정 생성 (관리자)' })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        loginId: { type: 'string', example: 'rentre' },
        password: { type: 'string', example: 'secure-password' },
        companyName: { type: 'string', example: '렌트리' },
      },
      required: ['loginId', 'password', 'companyName'],
    },
  })
  @ApiResponse({
    status: 201,
    description: '광고주 계정 생성 성공',
  })
  async createAdvertiser(
    @Headers('x-admin-api-key') apiKey: string,
    @Body() body: { loginId: string; password: string; companyName: string },
  ) {
    this.validateApiKey(apiKey);
    return this.advertiserAuthService.createAdvertiser(
      body.loginId,
      body.password,
      body.companyName,
    );
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
