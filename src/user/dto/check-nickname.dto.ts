import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CheckNicknameRequestDto {
  @ApiProperty({
    description: '중복 확인할 닉네임',
    example: '따뜻한고양이1234',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  nickname: string;
}

export class CheckNicknameResponseDto {
  @ApiProperty({
    description: '닉네임 중복 여부 (본인 제외)',
    example: false,
  })
  isDuplicate: boolean;
}
