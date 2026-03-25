import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AccountInfoResponseDto {
  @ApiProperty({ description: '은행명', example: '국민은행' })
  accountBank: string;

  @ApiProperty({ description: '표시용 계좌번호 (끝 4자리)', example: '1234' })
  displayNumber: string;

  @ApiProperty({ description: '계좌번호 길이', example: 14 })
  accountNumberLength: number;

  @ApiProperty({ description: '예금주명', example: '홍길동' })
  accountName: string;
}

export class CreateAccountInfoRequestDto {
  @ApiProperty({ description: '은행명', example: '국민은행' })
  @IsString()
  @IsNotEmpty()
  bank: string;

  @ApiProperty({ description: '예금주명', example: '홍길동' })
  @IsString()
  @IsNotEmpty()
  accountHolder: string;

  @ApiProperty({ description: '계좌번호 (숫자와 -만 허용)', example: '123-456-789012' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9-]+$/, { message: 'Invalid account number format' })
  accountNumber: string;
}

export class CreateAccountInfoResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiPropertyOptional({ description: '메시지' })
  message?: string;
}
