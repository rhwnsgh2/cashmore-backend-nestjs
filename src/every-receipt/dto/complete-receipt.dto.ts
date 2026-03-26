import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty } from 'class-validator';

export class CompleteReceiptRequestDto {
  @ApiProperty({ description: '영수증 ID', example: 123 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  everyReceiptId: number;
}

export class CompleteReceiptResponseDto {
  @ApiProperty({ description: '완료 처리 성공 여부', example: true })
  success: boolean;
}
