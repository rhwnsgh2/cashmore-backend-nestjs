import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// --- Request DTOs ---

export class ConnectNaverPayRequestDto {
  @ApiProperty({
    description: '네이버 로그인 유니크 아이디',
    example: 'naver-unique-id-123',
  })
  @IsString()
  @IsNotEmpty()
  uniqueId: string;
}

// --- Response DTOs ---

export class NaverPayAccountConnectedResponseDto {
  @ApiProperty({ description: '연결 여부', example: true })
  connected: boolean;

  @ApiProperty({
    description: '마스킹된 네이버 아이디',
    example: 'nav***',
    required: false,
  })
  maskingId?: string;

  @ApiProperty({
    description: '연결 시각',
    example: '2026-03-16T12:00:00Z',
    required: false,
  })
  connectedAt?: string;
}

export class ConnectNaverPaySuccessResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '연결 결과 데이터',
    required: false,
  })
  data?: {
    maskingId: string;
    naverPayPoint: number;
  };

  @ApiProperty({
    description: '에러 코드 (실패 시)',
    example: '52004',
    required: false,
  })
  errorCode?: string;

  @ApiProperty({
    description: '에러 메시지 (실패 시)',
    example: '네이버페이 가입 후 다시 시도해주세요',
    required: false,
  })
  errorMessage?: string;
}

export class DisconnectNaverPayResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;
}
