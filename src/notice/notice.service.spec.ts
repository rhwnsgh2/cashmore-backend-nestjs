import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NoticeService } from './notice.service';
import { NOTICE_REPOSITORY } from './interfaces/notice-repository.interface';
import { StubNoticeRepository } from './repositories/stub-notice.repository';

describe('NoticeService', () => {
  let service: NoticeService;
  let repository: StubNoticeRepository;

  beforeEach(async () => {
    repository = new StubNoticeRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticeService,
        { provide: NOTICE_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<NoticeService>(NoticeService);
  });

  describe('getNotices', () => {
    it('데이터가 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getNotices();
      expect(result).toEqual([]);
    });

    it('is_visible이 true인 공지만 반환한다', async () => {
      repository.setNotices([
        {
          id: 1,
          created_at: '2026-04-01T10:00:00Z',
          updated_at: '2026-04-01T10:00:00Z',
          title: '보이는 공지',
          content: '내용1',
          is_visible: true,
        },
        {
          id: 2,
          created_at: '2026-04-02T10:00:00Z',
          updated_at: '2026-04-02T10:00:00Z',
          title: '숨겨진 공지',
          content: '내용2',
          is_visible: false,
        },
      ]);

      const result = await service.getNotices();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('보이는 공지');
    });

    it('created_at 내림차순으로 정렬한다', async () => {
      repository.setNotices([
        {
          id: 1,
          created_at: '2026-04-01T10:00:00Z',
          updated_at: '2026-04-01T10:00:00Z',
          title: '오래된 공지',
          content: '',
          is_visible: true,
        },
        {
          id: 2,
          created_at: '2026-04-03T10:00:00Z',
          updated_at: '2026-04-03T10:00:00Z',
          title: '최신 공지',
          content: '',
          is_visible: true,
        },
        {
          id: 3,
          created_at: '2026-04-02T10:00:00Z',
          updated_at: '2026-04-02T10:00:00Z',
          title: '중간 공지',
          content: '',
          is_visible: true,
        },
      ]);

      const result = await service.getNotices();

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('최신 공지');
      expect(result[1].title).toBe('중간 공지');
      expect(result[2].title).toBe('오래된 공지');
    });

    it('모든 필드를 올바르게 반환한다', async () => {
      repository.setNotices([
        {
          id: 1,
          created_at: '2026-04-01T10:00:00Z',
          updated_at: '2026-04-02T12:00:00Z',
          title: '공지사항 제목',
          content: '<p>공지 내용입니다</p>',
          is_visible: true,
        },
      ]);

      const result = await service.getNotices();

      expect(result[0]).toEqual({
        id: 1,
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-02T12:00:00Z',
        title: '공지사항 제목',
        content: '<p>공지 내용입니다</p>',
        is_visible: true,
      });
    });
  });
});
