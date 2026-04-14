import { ApiProperty } from '@nestjs/swagger';

export class ApprovalItemResult {
  @ApiProperty({ description: 'affiliate_callback_data.id' })
  id: number;

  @ApiProperty({ description: '처리 성공 여부' })
  success: boolean;

  @ApiProperty({ required: false, description: '실패 사유' })
  error?: string;
}

export class AffiliateApprovalsResponseDto {
  @ApiProperty({ description: '조회된 pending 건 수' })
  processed: number;

  @ApiProperty({ description: '성공한 건 수' })
  successful: number;

  @ApiProperty({ description: '실패한 건 수' })
  failed: number;

  @ApiProperty({ type: [ApprovalItemResult] })
  details: ApprovalItemResult[];
}
