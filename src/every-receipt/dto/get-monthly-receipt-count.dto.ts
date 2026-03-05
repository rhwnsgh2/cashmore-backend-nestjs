import { ApiProperty } from '@nestjs/swagger';

export class MonthlyReceiptCountResponseDto {
  @ApiProperty({
    description: '이번 달 완료된 영수증 갯수',
    example: 5,
  })
  count: number;
}
