import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EveryReceiptDto {
  @ApiProperty({
    description: '영수증 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '생성 일시',
    example: '2026-01-15T10:30:00+09:00',
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: '획득 포인트',
    example: 250,
    nullable: true,
  })
  pointAmount: number | null;

  @ApiProperty({
    description: '처리 상태',
    enum: ['pending', 'completed', 'rejected'],
    example: 'completed',
  })
  status: string;

  @ApiPropertyOptional({
    description: '영수증 이미지 URL',
    example: 'https://storage.example.com/receipts/image.jpg',
    nullable: true,
  })
  imageUrl: string | null;
}

export class GetEveryReceiptsResponseDto {
  @ApiProperty({
    description: '영수증 목록',
    type: [EveryReceiptDto],
  })
  receipts: EveryReceiptDto[];
}
