import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EveryReceiptService } from './every-receipt.service';
import { EveryReceiptDto } from './dto/get-every-receipts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EveryReceipt } from './interfaces/every-receipt-repository.interface';

@ApiTags('EveryReceipt')
@Controller('every_receipt')
export class EveryReceiptController {
  constructor(private everyReceiptService: EveryReceiptService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '영수증 목록 조회',
    description: '사용자의 영수증 제출 내역을 최신순으로 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '영수증 목록 조회 성공',
    type: [EveryReceiptDto],
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getEveryReceipts(
    @CurrentUser('userId') userId: string,
  ): Promise<EveryReceipt[]> {
    return this.everyReceiptService.getEveryReceipts(userId);
  }
}
