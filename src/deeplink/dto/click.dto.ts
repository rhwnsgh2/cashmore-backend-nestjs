import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function IsStringRecord(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStringRecord',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            Object.values(value).every((v) => typeof v === 'string')
          );
        },
        defaultMessage() {
          return 'params의 모든 값은 문자열이어야 합니다';
        },
      },
    });
  };
}

export class ClickRequestDto {
  @ApiProperty({ description: '브라우저 User-Agent 문자열' })
  @IsString()
  @IsNotEmpty()
  userAgent: string;

  @ApiProperty({
    description: '전달할 파라미터',
    example: { code: 'ABC', receiptId: '123' },
  })
  @IsObject()
  @IsStringRecord()
  params: Record<string, string>;

  @ApiProperty({ description: '딥링크 경로', example: '/invite' })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiPropertyOptional({
    description:
      'Client Hints에서 가져온 실제 OS 버전 (e.g., "15.0.0", "18.3.1")',
  })
  @IsOptional()
  @IsString()
  platformVersion?: string;

  @ApiPropertyOptional({
    description: 'Client Hints에서 가져온 디바이스 모델 (e.g., "Pixel 7")',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: '화면 너비 (px)' })
  @IsOptional()
  @IsNumber()
  screenWidth?: number;

  @ApiPropertyOptional({ description: '화면 높이 (px)' })
  @IsOptional()
  @IsNumber()
  screenHeight?: number;
}
