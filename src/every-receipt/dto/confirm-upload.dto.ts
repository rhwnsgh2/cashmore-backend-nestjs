import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmUploadRequestDto {
  @ApiProperty({
    description: '업로드된 이미지의 공개 URL',
    example: 'https://storage.googleapis.com/every-receipt/user-id/image.jpg',
  })
  publicUrl: string;

  @ApiPropertyOptional({
    description: '영수증 촬영 위치 (GeoJSON Point)',
    example: 'POINT(127.0 37.5)',
  })
  currentPosition?: string;
}

export class ConfirmUploadResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '생성된 영수증 ID', example: 123 })
  everyReceiptId: number;

  @ApiProperty({
    description: '이미지 URL',
    example: 'https://storage.googleapis.com/every-receipt/user-id/image.jpg',
  })
  imageUrl: string;
}
