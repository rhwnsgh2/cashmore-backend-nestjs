import { ApiProperty } from '@nestjs/swagger';

export class SimulateDistributionItemDto {
  @ApiProperty({
    description: '영수증 수',
    example: 5,
  })
  receiptCount: number;

  @ApiProperty({
    description: '해당 영수증 수를 가진 유저 수',
    example: 120,
  })
  userCount: number;
}

export class SimulateDividendResponseDto {
  @ApiProperty({
    description: '영수증 수별 유저 분포',
    type: [SimulateDistributionItemDto],
  })
  distribution: SimulateDistributionItemDto[];

  @ApiProperty({
    description: '전체 유저 수',
    example: 1500,
  })
  totalUsers: number;

  @ApiProperty({
    description: '전체 영수증 수',
    example: 8500,
  })
  totalReceipts: number;
}
