import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AffiliateService } from './affiliate.service';
import { AffiliateApprovalsResponseDto } from './dto/approvals-response.dto';

@ApiTags('Affiliate')
@Controller('affiliate')
export class AffiliateController {
  constructor(
    private affiliateService: AffiliateService,
    private configService: ConfigService,
  ) {}

  @Post('cron/approvals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '어필리에이트 후정산 포인트 지급',
    description:
      'approval_date가 오늘 이하인 pending affiliate_callback_data를 조회해 AFFILIATE 포인트를 지급하고 상태를 completed로 업데이트합니다.',
  })
  @ApiHeader({ name: 'x-batch-api-key', required: true })
  @ApiResponse({ status: 200, type: AffiliateApprovalsResponseDto })
  async processApprovals(
    @Headers('x-batch-api-key') apiKey: string,
  ): Promise<AffiliateApprovalsResponseDto> {
    this.validateApiKey(apiKey);
    return this.affiliateService.processApprovals();
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid batch API key');
    }
  }
}
