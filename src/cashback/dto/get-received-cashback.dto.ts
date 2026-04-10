import { ApiProperty } from '@nestjs/swagger';

export class ReceivedCashbackResponseDto {
  @ApiProperty({ description: '총 수령 캐시백', example: 15000 })
  receivedCashback: number;
}
