import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class CreateInvitationPartnerRequestDto {
  @ApiProperty({
    description: '파트너로 등록할 유저 ID 배열',
    example: ['uuid1', 'uuid2'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  userIds: string[];

  @ApiProperty({
    description: '파트너 프로그램 시작 시각 (ISO8601)',
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsDateString()
  startsAt: string;

  @ApiProperty({
    description: '파트너 프로그램 종료 시각 (ISO8601)',
    example: '2026-05-31T23:59:59.999Z',
  })
  @IsDateString()
  endsAt: string;
}

export class CreateInvitationPartnerResponseDto {
  @ApiProperty({ description: '생성된 파트너 수', example: 3 })
  createdCount: number;
}

export class CreateInvitationPartnerConflictDto {
  @ApiProperty({ example: '이미 겹치는 기간에 등록된 유저가 있습니다.' })
  error: string;

  @ApiProperty({
    description: '겹치는 기간 프로그램을 이미 가진 유저 ID 목록',
    example: ['uuid-of-duplicate'],
    type: [String],
  })
  duplicateUserIds: string[];
}
