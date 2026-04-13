import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateNicknameRequestDto {
  @ApiProperty({
    description: '변경할 닉네임 (2~12자)',
    example: '따뜻한고양이1234',
    minLength: 2,
    maxLength: 12,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 12, { message: '닉네임은 2자 이상 12자 이하로 입력해주세요' })
  nickname: string;
}

export class UpdateNicknameResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;
}
