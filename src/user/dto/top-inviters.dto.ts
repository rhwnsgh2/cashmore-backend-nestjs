import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TopInvitersQueryDto {
  @ApiProperty({
    description: '최소 초대 인원 (누적)',
    example: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minInviteCount: number;
}

export class TopInviterDto {
  @ApiProperty({ description: '유저 ID (UUID)' })
  userId: string;

  @ApiProperty({ description: '유저 이메일', nullable: true })
  email: string | null;

  @ApiProperty({ description: '전체 누적 초대 인원' })
  inviteCount: number;
}

export class TopInvitersResponseDto {
  @ApiProperty({ type: [TopInviterDto] })
  users: TopInviterDto[];
}
