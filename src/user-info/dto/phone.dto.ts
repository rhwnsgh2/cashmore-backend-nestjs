import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpsertPhoneDto {
  @ApiProperty({
    example: '01012345678',
    description: '하이픈 포함 가능, 서버에서 정규화 후 저장',
  })
  @IsString()
  @Matches(/^[\d-\s]+$/, {
    message: 'phone must contain only digits and dashes',
  })
  phone!: string;
}

export class PhoneResponseDto {
  @ApiProperty({
    nullable: true,
    description: '저장된 휴대전화번호 (하이픈 없는 형식)',
    example: '01012345678',
  })
  phone!: string | null;
}
