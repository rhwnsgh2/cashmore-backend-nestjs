import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LottoProcessRequestDto {
  @ApiProperty({ description: '초대 코드', example: 'ABC234' })
  @IsString()
  @IsNotEmpty()
  inviteCode: string;

  @ApiProperty({
    description: '디바이스 ID',
    example: 'device-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class LottoProcessResponseDto {
  @ApiProperty({ description: '처리 성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '피초대자 랜덤 보상 포인트',
    example: 300,
    required: false,
  })
  rewardPoint?: number;

  @ApiProperty({
    description: '실패 시 에러 메시지',
    required: false,
  })
  error?: string;
}
