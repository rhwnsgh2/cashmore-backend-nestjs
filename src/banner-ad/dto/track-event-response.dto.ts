import { ApiProperty } from '@nestjs/swagger';

export class TrackEventResponseDto {
  @ApiProperty({ description: '이벤트 기록 성공 여부', example: true })
  success: boolean;
}
