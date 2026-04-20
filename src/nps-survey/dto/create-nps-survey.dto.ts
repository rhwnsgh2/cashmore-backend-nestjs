import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateNpsSurveyRequestDto {
  @ApiProperty({
    description: 'NPS 점수 (0~10)',
    example: 9,
    minimum: 0,
    maximum: 10,
  })
  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;

  @ApiPropertyOptional({ description: '피드백', example: '서비스가 편리해요' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

export class CreateNpsSurveyResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success!: boolean;
}
