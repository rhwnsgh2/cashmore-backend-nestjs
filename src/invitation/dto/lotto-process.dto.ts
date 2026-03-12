import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LottoProcessRequestDto {
  @ApiProperty({ description: '초대 코드', example: 'ABC234' })
  @IsString()
  @IsNotEmpty()
  invitationCode: string;
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
