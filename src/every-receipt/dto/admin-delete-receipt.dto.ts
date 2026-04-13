import { ApiProperty } from '@nestjs/swagger';

export class AdminDeleteReceiptResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '결과 메시지',
    example: '영수증이 삭제되었습니다.',
  })
  message: string;
}
