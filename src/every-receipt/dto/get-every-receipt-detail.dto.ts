import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EveryReceiptDetailResponseDto {
  @ApiProperty({ description: '영수증 ID', example: 123 })
  id: number;

  @ApiProperty({
    description: '생성 일시',
    example: '2026-01-15T10:30:00+09:00',
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: '획득 포인트',
    example: 25,
    nullable: true,
  })
  pointAmount: number | null;

  @ApiProperty({ description: '광고 시청 추가 포인트', example: 5 })
  adShowPoint: number;

  @ApiProperty({
    description: '처리 상태',
    enum: ['pending', 'completed', 'rejected'],
  })
  status: string;

  @ApiPropertyOptional({ description: '영수증 이미지 URL', nullable: true })
  imageUrl: string | null;

  @ApiPropertyOptional({
    description: '재검수 상태',
    enum: ['pending', 'completed', 'rejected'],
    nullable: true,
  })
  reReviewStatus: string | null;

  @ApiPropertyOptional({
    description: '영수증 유형',
    enum: ['offline', 'online', 'delivery', 'unknown'],
  })
  receiptType?: string;

  @ApiPropertyOptional({
    description: '매장 정보',
    enum: ['name_only', 'address_only', 'both', 'none'],
  })
  storeInfo?: string;

  @ApiPropertyOptional({
    description: '결제 정보',
    enum: ['amount_only', 'method_only', 'both', 'none'],
  })
  paymentInfo?: string;

  @ApiPropertyOptional({ description: '항목 포함 여부' })
  hasItems?: boolean;

  @ApiPropertyOptional({ description: '날짜 유효성 레벨 (1-5)' })
  dateValidity?: number;

  @ApiPropertyOptional({ description: '이미지 품질 레벨 (1-5)' })
  imageQuality?: number;

  @ApiPropertyOptional({ description: '재방문 레벨 (1-5)' })
  storeRevisit?: number;

  @ApiPropertyOptional({ description: '중복 영수증 여부' })
  isDuplicateReceipt?: boolean;

  @ApiPropertyOptional({ description: '총 점수' })
  totalScore?: number;

  @ApiPropertyOptional({
    description: '등급',
    enum: ['S', 'A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'F'],
  })
  grade?: string;
}
