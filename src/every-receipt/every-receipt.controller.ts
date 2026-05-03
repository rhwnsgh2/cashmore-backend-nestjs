import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EveryReceiptService } from './every-receipt.service';
import { EveryReceiptDto } from './dto/get-every-receipts.dto';
import { EveryReceiptDetailResponseDto } from './dto/get-every-receipt-detail.dto';
import { MonthlyReceiptCountResponseDto } from './dto/get-monthly-receipt-count.dto';
import {
  ConfirmUploadRequestDto,
  ConfirmUploadResponseDto,
} from './dto/confirm-upload.dto';
import {
  CompleteReceiptRequestDto,
  CompleteReceiptResponseDto,
} from './dto/complete-receipt.dto';
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

  @Post('re_review')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '영수증 재검수 요청',
    description:
      '완료된 영수증에 대해 재검수를 요청합니다. 기존 포인트는 환수됩니다.',
  })
  @ApiResponse({ status: 200, description: '재검수 요청 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async requestReReview(
    @CurrentUser('userId') userId: string,
    @Body() body: { id: number; requestedItems: string[]; userNote?: string },
  ) {
    return this.everyReceiptService.requestReReview(
      userId,
      body.id,
      body.requestedItems,
      body.userNote ?? '',
    );
  }

  @Get('re_review_tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '재검수 티켓 조회',
    description: '이번주 재검수 티켓 사용 현황을 조회합니다. 주당 5개 제공.',
  })
  @ApiResponse({ status: 200, description: '재검수 티켓 조회 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getReReviewTickets(@CurrentUser('userId') userId: string): Promise<{
    ticketCount: number;
    usedTickets: number;
    totalTickets: number;
  }> {
    return this.everyReceiptService.getReReviewTickets(userId);
  }

  @Get('count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '완료 영수증 총 개수 조회',
    description: '사용자의 완료(completed) 상태 영수증 총 개수를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '완료 영수증 개수 조회 성공',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getCompletedCount(
    @CurrentUser('userId') userId: string,
  ): Promise<{ count: number }> {
    return this.everyReceiptService.getCompletedCount(userId);
  }

  @Get('monthly-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '이번 달 완료 영수증 갯수 조회',
    description:
      '사용자가 이번 달에 제출하여 완료(completed)된 영수증의 갯수를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '이번 달 완료 영수증 갯수 조회 성공',
    type: MonthlyReceiptCountResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getMonthlyReceiptCount(
    @CurrentUser('userId') userId: string,
  ): Promise<MonthlyReceiptCountResponseDto> {
    return await this.everyReceiptService.getMonthlyReceiptCount(userId);
  }

  @Post('confirm-upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '영수증 업로드 확인',
    description:
      '업로드된 영수증 이미지를 확인하고 DB에 등록한 뒤 AI 처리 큐에 발행합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '영수증 업로드 확인 성공',
    type: ConfirmUploadResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async confirmUpload(
    @CurrentUser('userId') userId: string,
    @Body() body: ConfirmUploadRequestDto,
  ): Promise<ConfirmUploadResponseDto> {
    return await this.everyReceiptService.confirmUpload(
      userId,
      body.publicUrl,
      body.currentPosition ?? null,
    );
  }

  @Post('complete')
  @HttpCode(200)
  @ApiOperation({
    summary: '영수증 완료 처리',
    description:
      'AI 채점 완료 후 영수증을 최종 완료(또는 중복 reject) 처리하고 포인트를 지급합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '영수증 완료 처리 성공',
    type: CompleteReceiptResponseDto,
  })
  @ApiResponse({ status: 404, description: '영수증을 찾을 수 없음' })
  async completeReceipt(
    @Body() body: CompleteReceiptRequestDto,
  ): Promise<CompleteReceiptResponseDto> {
    return await this.everyReceiptService.completeReceipt(body.everyReceiptId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '영수증 상세 조회',
    description:
      '특정 영수증의 상세 정보를 조회합니다. score_data가 있으면 등급 정보도 포함됩니다.',
  })
  @ApiParam({ name: 'id', type: Number, description: '영수증 ID' })
  @ApiResponse({
    status: 200,
    description: '영수증 상세 조회 성공',
    type: EveryReceiptDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '영수증을 찾을 수 없음' })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async getEveryReceiptDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: string,
  ): Promise<EveryReceiptDetailResponseDto> {
    return this.everyReceiptService.getEveryReceiptDetail(id, userId);
  }
}
