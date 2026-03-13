import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SignupType {
  INVITATION_NORMAL = 'invitation_normal',
  INVITATION_RECEIPT = 'invitation_receipt',
}

export class SignupContextDto {
  @ApiProperty({
    description:
      '가입 경로 타입. invitation_normal: 일반 초대 링크 가입, invitation_receipt: 영수증 인증 초대 가입',
    enum: SignupType,
    example: SignupType.INVITATION_NORMAL,
  })
  @IsEnum(SignupType)
  type: SignupType;

  @ApiProperty({ description: '초대 코드', example: 'ABC234' })
  @IsString()
  @IsNotEmpty()
  invitationCode: string;

  @ApiPropertyOptional({
    description: '영수증 ID. type이 invitation_receipt일 때 필수.',
    example: 12345,
  })
  @IsOptional()
  @IsNumber()
  receiptId?: number;
}

export class CreateUserRequestDto {
  @ApiPropertyOptional({ description: 'FCM 토큰', example: 'fcm-token-xxx' })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiProperty({ description: '마케팅 정보 수신 동의', example: false })
  @IsBoolean()
  marketingAgreement: boolean;

  @ApiProperty({ description: '온보딩 완료 여부', example: true })
  @IsBoolean()
  onboardingCompleted: boolean;

  @ApiPropertyOptional({
    description: '디바이스 ID',
    example: 'device-id-xxx',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description:
      '가입 경로 정보. 초대 링크를 통한 가입 시 type과 invitationCode를 함께 전달. 미전송 시 기존 가입 플로우 동작.',
    type: SignupContextDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignupContextDto)
  signupContext?: SignupContextDto;
}

export class InvitationRewardResultDto {
  @ApiProperty({
    description: '가입 경로 타입',
    enum: SignupType,
    example: SignupType.INVITATION_NORMAL,
  })
  type: SignupType;

  @ApiProperty({ description: '초대 보상 처리 성공 여부', example: true })
  success: boolean;

  @ApiPropertyOptional({
    description: '피초대자 랜덤 보상 포인트 (invitation_normal 성공 시)',
    example: 100,
  })
  rewardPoint?: number;

  @ApiPropertyOptional({ description: '실패 시 에러 메시지' })
  error?: string;

  @ApiPropertyOptional({
    description: '영수증 포인트 (invitation_receipt 성공 시)',
    example: 50,
  })
  receiptPoint?: number;
}

export class CreateUserResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: '생성된 사용자 ID' })
  userId?: string;

  @ApiPropertyOptional({ description: '생성된 닉네임' })
  nickname?: string;

  @ApiPropertyOptional({ description: '에러 메시지' })
  error?: string;

  @ApiPropertyOptional({
    description: '초대 보상 처리 결과. signupContext가 있을 때만 포함됨.',
    type: InvitationRewardResultDto,
  })
  invitationReward?: InvitationRewardResultDto;
}
