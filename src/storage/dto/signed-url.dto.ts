import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignedUrlRequestDto {
  @ApiPropertyOptional({
    description: '업로드할 파일의 Content-Type',
    example: 'image/jpeg',
    default: 'image/jpeg',
  })
  contentType?: string;
}

export class SignedUrlResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '서명된 업로드 URL',
    example: 'https://storage.googleapis.com/...',
  })
  uploadUrl: string;

  @ApiPropertyOptional({
    description: '업로드 시 필요한 추가 필드',
  })
  uploadFields?: Record<string, string>;

  @ApiProperty({
    description: '저장된 이미지 경로',
    example: 'user-id/2026-03-09T12:00:00.000Z_abc123',
  })
  imagePath: string;

  @ApiProperty({
    description: '이미지 공개 URL',
    example: 'https://storage.googleapis.com/every-receipt/...',
  })
  publicUrl: string;
}
