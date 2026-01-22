import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserModalDto {
  @ApiProperty({
    description: '모달 ID',
    example: 12345,
  })
  id: number;

  @ApiProperty({
    description: '모달 이름',
    enum: [
      'onboarding',
      'interview',
      'nps_survey',
      'drop_cashback_received',
      'claim_cashback_received',
      'invite_code_input',
      'invite_code_input_lotto',
      'exchange_point_to_cash',
      'invite_reward_received',
      'invited_user_reward_received',
      'invited_user_mission_reward',
      'affiliate_prepayment_received',
      'every_receipt_re_reviewed',
    ],
    example: 'onboarding',
  })
  name: string;

  @ApiProperty({
    description: '모달 상태',
    enum: ['pending', 'completed'],
    example: 'pending',
  })
  status: string;

  @ApiPropertyOptional({
    description: '추가 데이터',
    example: { amount: 1000 },
    nullable: true,
  })
  additionalData: Record<string, unknown> | null;
}

export class GetUserModalsResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '모달 목록',
    type: [UserModalDto],
  })
  modals: UserModalDto[];
}
