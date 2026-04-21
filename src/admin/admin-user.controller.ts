import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InvitationService } from '../invitation/invitation.service';
import {
  TopInvitersQueryDto,
  TopInvitersResponseDto,
} from '../user/dto/top-inviters.dto';

@ApiTags('Admin - User')
@Controller('admin/users')
export class AdminUserController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly configService: ConfigService,
  ) {}

  @Get('top-inviters')
  @ApiOperation({
    summary: '초대 수 상위 유저 조회 (어드민)',
    description:
      '전체 누적 초대 인원이 minInviteCount 이상인 유저 목록을 반환한다. 파트너 프로그램 등록 대상 선정에 사용.',
  })
  @ApiHeader({ name: 'x-admin-api-key', required: true })
  @ApiResponse({ status: 200, type: TopInvitersResponseDto })
  async topInviters(
    @Headers('x-admin-api-key') apiKey: string,
    @Query() query: TopInvitersQueryDto,
  ): Promise<TopInvitersResponseDto> {
    this.validateApiKey(apiKey);
    const users = await this.invitationService.findTopInviters(
      query.minInviteCount,
    );
    return { users };
  }

  private validateApiKey(apiKey: string): void {
    const expectedKey = this.configService.get<string>('BATCH_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
