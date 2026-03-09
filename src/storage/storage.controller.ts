import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StorageAppService } from './storage.service';
import {
  SignedUrlRequestDto,
  SignedUrlResponseDto,
} from './dto/signed-url.dto';

@ApiTags('Storage')
@Controller('every_receipt/signed-url')
export class StorageController {
  constructor(private storageAppService: StorageAppService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '영수증 이미지 업로드용 Signed URL 생성',
    description:
      'GCS에 이미지를 업로드하기 위한 서명된 URL을 생성합니다. 클라이언트는 반환된 uploadUrl로 PUT 요청하여 이미지를 업로드합니다.',
  })
  @ApiResponse({
    status: 201,
    description: 'Signed URL 생성 성공',
    type: SignedUrlResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (토큰 없음, 만료, 유효하지 않음)',
  })
  async generateSignedUrl(
    @CurrentUser('userId') userId: string,
    @Body() dto: SignedUrlRequestDto,
  ): Promise<SignedUrlResponseDto> {
    return this.storageAppService.generateSignedUploadUrl(
      userId,
      dto.contentType,
    );
  }
}
