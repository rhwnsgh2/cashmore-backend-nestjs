import { ApiProperty } from '@nestjs/swagger';

export class CanInputInviteCodeResponseDto {
  @ApiProperty({
    description: '초대 코드 입력 가능 여부',
    example: true,
  })
  canInput: boolean;
}
