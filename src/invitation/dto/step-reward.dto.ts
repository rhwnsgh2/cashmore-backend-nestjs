import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class StepRewardRequestDto {
  @ApiProperty({ description: '단계 초대 수', example: 3 })
  @IsInt()
  @Min(1)
  stepCount: number;
}

export class StepRewardResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '에러 메시지',
    example: undefined,
    required: false,
  })
  error?: string;
}
