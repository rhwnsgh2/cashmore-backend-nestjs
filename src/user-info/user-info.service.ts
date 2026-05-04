import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  USER_INFO_REPOSITORY,
  type IUserInfoRepository,
} from './interfaces/user-info-repository.interface';

// 010 → 8자리, 011/016/017/018/019 → 7~8자리 (이전 통신사 번호 호환)
const MOBILE_REGEX = /^(010\d{8}|01[16789]\d{7,8})$/;

@Injectable()
export class UserInfoService {
  constructor(
    @Inject(USER_INFO_REPOSITORY)
    private repository: IUserInfoRepository,
  ) {}

  async getPhone(userId: string): Promise<string | null> {
    return this.repository.findPhoneByUserId(userId);
  }

  /** 하이픈/공백 제거 후 한국 휴대폰 형식 검증 → UPSERT. */
  async upsertPhone(userId: string, rawPhone: string): Promise<string> {
    const normalized = rawPhone.replace(/[\s-]/g, '');
    if (!MOBILE_REGEX.test(normalized)) {
      throw new BadRequestException(
        'Invalid phone format (expected Korean mobile, e.g. 01012345678)',
      );
    }
    const row = await this.repository.upsertPhone(userId, normalized);
    return row.phone_number;
  }
}
