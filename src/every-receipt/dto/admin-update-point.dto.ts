import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class AdminUpdatePointRequestDto {
  @ApiProperty({ description: '새로운 포인트 값', example: 25 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  newPoint: number;
}

export class AdminUpdatePointResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;
}
