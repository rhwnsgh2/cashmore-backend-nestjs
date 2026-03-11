import { ApiProperty } from '@nestjs/swagger';

export class InvitationResponseDto {
  @ApiProperty({ description: '초대장 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '초대장 발신자 ID', example: 'uuid-string' })
  senderId: string;

  @ApiProperty({
    description: '생성일시',
    example: '2026-03-11T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({ description: '초대 코드 (6자리)', example: 'ABC234' })
  identifier: string;

  @ApiProperty({
    description: '초대장 유형',
    enum: ['default', 'normal'],
    example: 'normal',
  })
  type: 'default' | 'normal';

  @ApiProperty({
    description: '초대장 상태',
    enum: ['pending', 'used'],
    example: 'pending',
  })
  status: 'pending' | 'used';
}
