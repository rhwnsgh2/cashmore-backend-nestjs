import { ApiProperty } from '@nestjs/swagger';

export class AggregateResponseDto {
  @ApiProperty({ description: '집계된 유저 수', example: 1500 })
  aggregatedUsers: number;

  @ApiProperty({ description: '집계 대상 월', example: '2026-01' })
  targetMonth: string;
}

export class ExpirePreviewTargetDto {
  @ApiProperty({ description: '유저 ID' })
  userId: string;

  @ApiProperty({ description: '소멸 예정 포인트', example: 1200 })
  expiringPoints: number;
}

export class ExpirePreviewResponseDto {
  @ApiProperty({
    description: '소멸 대상 유저 목록',
    type: [ExpirePreviewTargetDto],
  })
  targets: ExpirePreviewTargetDto[];

  @ApiProperty({ description: '총 소멸 예정 포인트', example: 450000 })
  totalExpiredPoints: number;

  @ApiProperty({ description: '소멸 기준 월', example: '2025-07' })
  expirationMonth: string;
}

export class ExpireResponseDto {
  @ApiProperty({ description: '소멸된 유저 수', example: 320 })
  expiredUsers: number;

  @ApiProperty({ description: '총 소멸된 포인트', example: 450000 })
  totalExpiredPoints: number;

  @ApiProperty({ description: '소멸 기준 월', example: '2025-07' })
  expirationMonth: string;
}

export class RollbackExpireResponseDto {
  @ApiProperty({ description: '삭제된 소멸 레코드 수', example: 320 })
  deletedCount: number;

  @ApiProperty({ description: '소멸 기준 월', example: '2025-07' })
  expirationMonth: string;
}

export class MonthlyBatchResponseDto {
  @ApiProperty({ description: '집계된 유저 수', example: 1500 })
  aggregatedUsers: number;

  @ApiProperty({ description: '소멸된 유저 수', example: 320 })
  expiredUsers: number;

  @ApiProperty({ description: '총 소멸된 포인트', example: 450000 })
  totalExpiredPoints: number;

  @ApiProperty({ description: '집계 대상 월', example: '2026-01' })
  targetMonth: string;

  @ApiProperty({ description: '소멸 기준 월', example: '2025-07' })
  expirationMonth: string;
}
