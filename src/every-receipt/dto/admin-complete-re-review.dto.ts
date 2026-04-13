import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsObject, Min } from 'class-validator';

export class AdminCompleteReReviewRequestDto {
  @ApiProperty({ description: '영수증 ID', example: 123 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  everyReceiptId: number;

  @ApiProperty({
    description: '재검수 후 score_data (total_score 제외, 각 항목별 점수)',
    example: {
      items: { score: 10, reason: 'good' },
      store_name: { score: 5, reason: 'found' },
    },
  })
  @IsNotEmpty()
  @IsObject()
  afterScoreData: Record<string, unknown>;

  @ApiProperty({ description: '재검수 후 포인트', example: 30 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterPoint: number;

  @ApiProperty({ description: '재검수 후 총 점수', example: 85 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  afterTotalScore: number;
}

export class AdminCompleteReReviewResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '처리 결과 메시지 (포인트 변경 없는 경우)',
    example: '재검수 포인트가 변경되지 않았습니다.',
    required: false,
  })
  message?: string;
}
