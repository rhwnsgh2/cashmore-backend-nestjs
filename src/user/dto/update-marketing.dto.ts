import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMarketingRequestDto {
  @ApiProperty({ description: '마케팅 정보 수신 동의', example: true })
  @IsBoolean()
  marketingAgreement: boolean;
}

export class UpdateMarketingResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '업데이트된 마케팅 동의 여부', example: true })
  marketingAgreement: boolean;
}
