import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { IpWhitelistGuard } from './ip-whitelist.guard';

function createMockContext(ip: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
    }),
  } as any;
}

describe('IpWhitelistGuard', () => {
  const guard = new IpWhitelistGuard();

  it('허용된 Buzzvil IP는 통과한다', () => {
    expect(guard.canActivate(createMockContext('13.231.21.93'))).toBe(true);
    expect(guard.canActivate(createMockContext('18.179.158.39'))).toBe(true);
    expect(guard.canActivate(createMockContext('52.68.114.43'))).toBe(true);
  });

  it('허용되지 않은 IP는 ForbiddenException을 던진다', () => {
    expect(() => guard.canActivate(createMockContext('1.2.3.4'))).toThrow(
      ForbiddenException,
    );
  });

  it('localhost IP는 차단된다', () => {
    expect(() => guard.canActivate(createMockContext('127.0.0.1'))).toThrow(
      ForbiddenException,
    );
  });
});
