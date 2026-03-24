import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';

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

// --- Exchange DTOs ---

export class CreateExchangeRequestDto {
  @ApiProperty({ description: '전환할 캐시모어 포인트', example: 5000 })
  @IsInt()
  @Min(1)
  point: number;
}

export class CreateExchangeResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '전환 요청 데이터', required: false })
  data?: {
    exchangeId: string;
    cashmorePoint: number;
    naverpayPoint: number;
    status: string;
  };
}

export class ExchangeItemDto {
  @ApiProperty({ description: '전환 요청 ID' })
  id: string;

  @ApiProperty({ description: '차감 캐시모어 포인트', example: 5000 })
  cashmorePoint: number;

  @ApiProperty({ description: '전환 네이버페이 포인트', example: 5000 })
  naverpayPoint: number;

  @ApiProperty({ description: '상태', example: 'pending' })
  status: string;

  @ApiProperty({ description: '요청 시각' })
  createdAt: string;

  @ApiProperty({ description: '처리 시각', required: false })
  processedAt?: string;
}

export class ExchangeListResponseDto {
  @ApiProperty({ type: [ExchangeItemDto] })
  exchanges: ExchangeItemDto[];
}

export class ExchangeConfigResponseDto {
  @ApiProperty({ description: '전환 비율', example: 1 })
  exchangeRate: number;

  @ApiProperty({ description: '최소 전환 포인트', example: 1000 })
  minPoint: number;

  @ApiProperty({ description: '일일 요청 제한', example: 1 })
  dailyLimit: number;

  @ApiProperty({ description: '오늘 사용 횟수', example: 0 })
  todayUsed: number;
}
