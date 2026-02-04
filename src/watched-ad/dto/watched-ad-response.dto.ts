import { ApiProperty } from '@nestjs/swagger';

// POST /watched-ad-status 응답
export class WatchedAdSetResponseDto {
  @ApiProperty({
    description: '광고 시청 기록 성공 여부',
    example: true,
  })
  success: boolean;
}
