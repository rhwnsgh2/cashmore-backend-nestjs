import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InvitationService } from '../invitation/invitation.service';
import {
  CreateInvitationPartnerConflictDto,
  CreateInvitationPartnerRequestDto,
  CreateInvitationPartnerResponseDto,
} from '../invitation/dto/admin-invitation-partner.dto';

@ApiTags('Admin - InvitationPartner')
@Controller('admin/invitation-partner')
export class AdminInvitationPartnerController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @ApiOperation({
    summary: '파트너 일괄 등록 (어드민)',
    description:
      '주어진 유저들을 지정 기간의 파트너 프로그램에 등록한다. 한 명이라도 겹치는 기간의 기존 프로그램을 가지면 전체 롤백하고 409를 반환한다.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 201, type: CreateInvitationPartnerResponseDto })
  @ApiResponse({ status: 409, type: CreateInvitationPartnerConflictDto })
  async create(
    @Headers('x-admin-api-key') apiKey: string,
    @Body() body: CreateInvitationPartnerRequestDto,
  ): Promise<CreateInvitationPartnerResponseDto> {
    this.validateApiKey(apiKey);
    return this.invitationService.registerPartners({
      userIds: body.userIds,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
    });
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
