import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EveryReceiptService } from '../every-receipt/every-receipt.service';
import { AdminDeleteReceiptResponseDto } from '../every-receipt/dto/admin-delete-receipt.dto';
import {
  AdminUpdatePointRequestDto,
  AdminUpdatePointResponseDto,
} from '../every-receipt/dto/admin-update-point.dto';
import {
  AdminCompleteReReviewRequestDto,
  AdminCompleteReReviewResponseDto,
} from '../every-receipt/dto/admin-complete-re-review.dto';

@ApiTags('Admin - EveryReceipt')
@Controller('admin/every-receipt')
export class AdminEveryReceiptController {
  constructor(
    private readonly everyReceiptService: EveryReceiptService,
    private readonly configService: ConfigService,
  ) {}

  @Delete(':id')
  @ApiOperation({
    summary: '영수증 삭제 (어드민)',
    description:
      '영수증을 삭제하면서 completed 상태였던 경우 원장에 reversal 행을 추가해 잔액을 정확히 환수한다.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, type: AdminDeleteReceiptResponseDto })
  async deleteReceipt(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id') id: string,
  ): Promise<AdminDeleteReceiptResponseDto> {
    this.validateApiKey(apiKey);
    return this.everyReceiptService.adminDeleteReceipt(Number(id));
  }

  @Patch(':id/point')
  @ApiOperation({
    summary: '영수증 포인트 수정 (어드민)',
    description:
      '영수증 포인트를 수정한다. completed 상태인 경우에만 원장에 delta 행을 추가한다.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, type: AdminUpdatePointResponseDto })
  async updatePoint(
    @Headers('x-admin-api-key') apiKey: string,
    @Param('id') id: string,
    @Body() body: AdminUpdatePointRequestDto,
  ): Promise<AdminUpdatePointResponseDto> {
    this.validateApiKey(apiKey);
    return this.everyReceiptService.adminUpdatePoint(Number(id), body.newPoint);
  }

  @Post('re-review/complete')
  @HttpCode(200)
  @ApiOperation({
    summary: '재검수 완료 처리 (어드민)',
    description:
      '재검수 요청을 처리한다. afterPoint가 beforePoint 이하면 원래 포인트 재지급, 초과면 상향 지급. 모두 append-only 행으로 기록.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, type: AdminCompleteReReviewResponseDto })
  async completeReReview(
    @Headers('x-admin-api-key') apiKey: string,
    @Body() body: AdminCompleteReReviewRequestDto,
  ): Promise<AdminCompleteReReviewResponseDto> {
    this.validateApiKey(apiKey);
    return this.everyReceiptService.adminCompleteReReview({
      everyReceiptId: body.everyReceiptId,
      afterScoreData: body.afterScoreData,
      afterPoint: body.afterPoint,
      afterTotalScore: body.afterTotalScore,
    });
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
