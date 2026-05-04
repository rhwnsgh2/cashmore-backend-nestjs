import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserInfoService } from './user-info.service';
import { USER_INFO_REPOSITORY } from './interfaces/user-info-repository.interface';
import { StubUserInfoRepository } from './repositories/stub-user-info.repository';

const USER_ID = '00000000-0000-0000-0000-000000000001';

describe('UserInfoService', () => {
  let service: UserInfoService;
  let repo: StubUserInfoRepository;

  beforeEach(async () => {
    repo = new StubUserInfoRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserInfoService,
        { provide: USER_INFO_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get<UserInfoService>(UserInfoService);
  });

  describe('getPhone', () => {
    it('등록된 적 없으면 null', async () => {
      const phone = await service.getPhone(USER_ID);
      expect(phone).toBeNull();
    });

    it('등록된 phone 반환', async () => {
      await service.upsertPhone(USER_ID, '01012345678');
      expect(await service.getPhone(USER_ID)).toBe('01012345678');
    });
  });

  describe('upsertPhone', () => {
    it('하이픈 자동 제거 후 저장', async () => {
      const phone = await service.upsertPhone(USER_ID, '010-1234-5678');
      expect(phone).toBe('01012345678');
    });

    it('공백 제거', async () => {
      const phone = await service.upsertPhone(USER_ID, '010 1234 5678');
      expect(phone).toBe('01012345678');
    });

    it('두 번째 호출은 UPDATE (id 유지)', async () => {
      await service.upsertPhone(USER_ID, '01012345678');
      const before = await repo.findPhoneByUserId(USER_ID);
      expect(before).toBe('01012345678');

      await service.upsertPhone(USER_ID, '01099998888');
      const after = await repo.findPhoneByUserId(USER_ID);
      expect(after).toBe('01099998888');
    });

    it.each([
      '010-123-4567', // 8자리 안 됨
      '02-1234-5678', // 010~ 외
      '0101234567', // 너무 짧음 (10자리)
      'abcdef',
      '',
    ])('잘못된 형식 %s → BadRequestException', async (input) => {
      await expect(service.upsertPhone(USER_ID, input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      ['01012345678', '01012345678'],
      ['010-1234-5678', '01012345678'],
      ['0111234567', '0111234567'], // 011 10자리
      ['01612345678', '01612345678'], // 016
    ])('유효한 형식 %s → %s 저장', async (input, expected) => {
      const phone = await service.upsertPhone(USER_ID, input);
      expect(phone).toBe(expected);
    });
  });
});
