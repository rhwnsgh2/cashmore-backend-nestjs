import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyInvitationRequestDto {
  @ApiProperty({ description: '초대 코드', example: 'ABC234' })
  @IsString()
  @IsNotEmpty()
  invitationCode: string;
}

export class VerifyInvitationResponseDto {
  @ApiProperty({ description: '검증 성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '실패 시 에러 메시지',
    example: '본인의 초대 코드는 사용할 수 없습니다.',
    required: false,
  })
  error?: string;
}
