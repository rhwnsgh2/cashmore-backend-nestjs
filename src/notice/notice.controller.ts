import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoticeService } from './notice.service';
import type { Notice } from './interfaces/notice-repository.interface';

@ApiTags('Notice')
@Controller('notices')
export class NoticeController {
  constructor(private noticeService: NoticeService) {}

  @Get()
  @ApiOperation({
    summary: '공지사항 목록 조회',
    description: '표시 가능한 공지사항을 최신순으로 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '공지사항 목록 조회 성공' })
  async getNotices(): Promise<Notice[]> {
    return this.noticeService.getNotices();
  }
}
