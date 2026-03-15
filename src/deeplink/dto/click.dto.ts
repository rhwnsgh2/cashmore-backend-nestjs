import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
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
  @ApiProperty({ description: '클라이언트 IP (SSR에서 전달)' })
  @IsString()
  @IsNotEmpty()
  clientIp: string;

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
}
