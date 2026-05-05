import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach } from 'vitest';
import { AccountInfoService } from './account-info.service';
import { ACCOUNT_INFO_REPOSITORY } from './interfaces/account-info-repository.interface';
import { StubAccountInfoRepository } from './repositories/stub-account-info.repository';
import * as crypto from 'crypto';

// 테스트용 RSA 키 페어 — 서비스에 하드코딩된 PUBLIC_KEY와 쌍을 이루는 실제 PRIVATE_KEY 사용
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+B0VimXjBan46
9/CcpD8bvoRdIn8WcSQiXHOokAaH0ZvPSB4pw8C8+zYqGJ0IvFMBIIbLT7cQZ8jO
WWUFII/0W+7em2K8sWGS5WMb8DSz75ha1vechjN0hK5IpK8uR2scjNVPL68l9jSk
tpPOx506YbCRPUwb6ka+xtPFU6km+BJlQPYzFMEbwqJBrekrM26MqjCvmnnoGUhm
VFuDEO1reDMNaVxwk78yOWgDzGP5kIBqS0l2M1nPl4BDAQbB1Gw5kFv3rMLoEbr9
FVnKVXAY5sSAOMQ6F5FKxUk6/NCwnzgG9RFF8PfnD8/9KM7c75VeJJ8DMyXw6jLj
vclaiUkbAgMBAAECggEACjKfsZvk1BRf89AsdGuIC3gc6FaalVy7ALEPb+NSxmUk
RGptW/ZqWHnuvTGW88oPdkcFlNGRVGsNZq17c1v8/bMVTZLvKIsoXla7C9vHKETa
Wz2gCiFVj5IzPCjCUex5Pg38wIQhlRryVkiKBBXIRULK0/CDLhhTdZd78+H6eOHN
R1RqMakqlcBQvQr+LZOK5MlOgeE58KqFsrjiZxHTQDvEVGLxztgFSPBcFVI4igMs
Tf+5cCmSzYzB8eqmeaWxuVaZCHUE45H0Ra/TprDOfxXxZrLqLvudLSTwuQW3pcDw
F5QkGP9wCELrBmFowiHUlg+BlUmyoxsLyYzrKnX3mQKBgQD+1ZldgMh6UHSOPm6l
9NGsNtx+tsRAv9FM2wO3rMdRDOoPFsngw65EGktdB/xqYeAaJc+aS7BrA/crBPmd
H9i3lPRHgaLuIOrbRGFk3GCtoxoGArjR14Y0/F3ZefhdCVvqDUCiEYPedbWsxIWh
46vfq8xyzNje/xKCuT0arLR4hQKBgQC+5clnxsxeKmAFgGQ5MuiH3IWcxtmVri4L
B9Cq1AO1sh22eiIgMdJ5NDKufd1g3RQGZDeYLEHvOSInMLzrr4J8ArPtg8qymMvm
FI5M0kNJINKaxtkx8AMeYVIec3b5L/3NUbCsQ9GL47UtGU5wVlG0r3+5Jbx5sXJy
Lcyx7Us9HwKBgQDmP3w4nXmF+le1hfdXfyJLJa6H1v7vOeEUPfbX6AaW1sJMK9zv
dh5obhGV1vdb718agPtYf/bAWm7isbYPH40iIjWsvhbGbXuF7fzJssyvVmTW9XKk
NsWN7k+lhay/8wrXKG4zgPvS7iveFBphsWHD0GgDec6hfXnuHwx0o4LUOQKBgEnZ
SR3taRgwmm7maV87U3tjkwjAYGIoPMWlo1LCrCC5JAd4ngUIYRzkVYrtRBv5yopi
cKNc07EA0DaLAzrF7dudjA+hQWPv+kkqwJX1bXQ3z2Fy9Yj9CafSDFudXXQu3ad1
J7ysi77rOyaUOKT6r6cPkYCFmbEWNWj4UMywOMAPAoGBALM65oxoZshHukSCMGxB
e1vQRK8JO+oOIeGkCfu/Ylo7uUQ1T3/ur5ePMdnVPTlVy3aRC1OwFeSGU97xaqs8
j+8sLZSK6tfmOS48Acvfl+OlLaKJCnuRrhJvA+Rdw/xcE9zmIyZg/yMU7o2XtP3S
jLaFb4q/3dgUBFWRBGNj/d9D
-----END PRIVATE KEY-----`;

const PUBLIC_KEY =
  `-----BEGIN PUBLIC KEY-----\n` +
  `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvgdFYpl4wWp+OvfwnKQ/\n` +
  `G76EXSJ/FnEkIlxzqJAGh9Gbz0geKcPAvPs2KhidCLxTASCGy0+3EGfIzlllBSCP\n` +
  `9Fvu3ptivLFhkuVjG/A0s++YWtb3nIYzdISuSKSvLkdrHIzVTy+vJfY0pLaTzsed\n` +
  `OmGwkT1MG+pGvsbTxVOpJvgSZUD2MxTBG8KiQa3pKzNujKowr5p56BlIZlRbgxDt\n` +
  `a3gzDWlccJO/MjloA8xj+ZCAaktJdjNZz5eAQwEGwdRsOZBb96zC6BG6/RVZylVw\n` +
  `GObEgDjEOheRSsVJOvzQsJ84BvURRfD35w/P/SjO3O+VXiSfAzMl8Ooy473JWolJ\n` +
  `GwIDAQAB\n` +
  `-----END PUBLIC KEY-----`;

function encryptWithPublicKey(text: string): string {
  return crypto
    .publicEncrypt(
      {
        key: PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      Buffer.from(text, 'utf-8'),
    )
    .toString('base64');
}

describe('AccountInfoService', () => {
  let service: AccountInfoService;
  let stubRepo: StubAccountInfoRepository;

  beforeEach(async () => {
    stubRepo = new StubAccountInfoRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountInfoService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'accountEncrypt.privateKey') return TEST_PRIVATE_KEY;
              return undefined;
            },
          },
        },
        {
          provide: ACCOUNT_INFO_REPOSITORY,
          useValue: stubRepo,
        },
      ],
    }).compile();

    service = module.get<AccountInfoService>(AccountInfoService);
  });

  describe('getAccountInfo', () => {
    it('계좌 정보가 없으면 null을 반환한다', async () => {
      const result = await service.getAccountInfo('user-1');
      expect(result).toBeNull();
    });

    it('계좌 정보가 있으면 복호화된 정보를 반환한다', async () => {
      const encrypted = encryptWithPublicKey('1234567890');

      stubRepo.setAccounts([
        {
          id: 1,
          userId: 'user-1',
          accountBank: '국민은행',
          accountNumber: encrypted,
          accountUserName: '홍길동',
          displayNumber: '7890',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]);

      const result = await service.getAccountInfo('user-1');

      expect(result).not.toBeNull();
      expect(result!.accountBank).toBe('국민은행');
      expect(result!.displayNumber).toBe('7890');
      expect(result!.accountNumberLength).toBe(10);
      expect(result!.accountName).toBe('홍길동');
    });

    it('여러 계좌가 있으면 최신 것을 반환한다', async () => {
      const encrypted1 = encryptWithPublicKey('11122233344');
      const encrypted2 = encryptWithPublicKey('44455566677');

      stubRepo.setAccounts([
        {
          id: 1,
          userId: 'user-1',
          accountBank: '국민은행',
          accountNumber: encrypted1,
          accountUserName: '홍길동',
          displayNumber: '3344',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          userId: 'user-1',
          accountBank: '신한은행',
          accountNumber: encrypted2,
          accountUserName: '홍길동',
          displayNumber: '6677',
          createdAt: '2026-01-02T00:00:00Z',
        },
      ]);

      const result = await service.getAccountInfo('user-1');

      expect(result!.accountBank).toBe('신한은행');
      expect(result!.displayNumber).toBe('6677');
    });

    it('다른 유저의 계좌 정보는 반환하지 않는다', async () => {
      const encrypted = encryptWithPublicKey('1234567890');

      stubRepo.setAccounts([
        {
          id: 1,
          userId: 'user-A',
          accountBank: '국민은행',
          accountNumber: encrypted,
          accountUserName: '홍길동',
          displayNumber: '7890',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]);

      const result = await service.getAccountInfo('user-B');
      expect(result).toBeNull();
    });
  });

  describe('createAccountInfo', () => {
    it('평문 계좌번호를 받으면 서버에서 암호화하여 저장한다', async () => {
      const result = await service.createAccountInfo(
        'user-1',
        '국민은행',
        '홍길동',
        '12345678901234',
      );

      expect(result).toEqual({
        success: true,
        message: '계좌 정보가 등록되었습니다.',
      });

      const accounts = stubRepo.getInsertedAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].accountBank).toBe('국민은행');
      expect(accounts[0].accountUserName).toBe('홍길동');
      expect(accounts[0].displayNumber).toBe('1234');
    });

    it('저장된 계좌번호는 암호화되어 있다', async () => {
      await service.createAccountInfo(
        'user-1',
        '국민은행',
        '홍길동',
        '12345678901234',
      );

      const accounts = stubRepo.getInsertedAccounts();
      // 암호화된 값은 원본과 다르고 base64 형태(344자)
      expect(accounts[0].accountNumber).not.toBe('12345678901234');
      expect(accounts[0].accountNumber).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(accounts[0].accountNumber.length).toBe(344);
    });

    it('암호화된 계좌번호를 복호화하면 원본이 나온다', async () => {
      await service.createAccountInfo(
        'user-1',
        '국민은행',
        '홍길동',
        '12345678901234',
      );

      const accounts = stubRepo.getInsertedAccounts();
      const decrypted = crypto
        .privateDecrypt(
          {
            key: TEST_PRIVATE_KEY,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha1',
          },
          Buffer.from(accounts[0].accountNumber, 'base64'),
        )
        .toString('utf-8');

      expect(decrypted).toBe('12345678901234');
    });

    it('displayNumber는 계좌번호 끝 4자리이다', async () => {
      await service.createAccountInfo(
        'user-1',
        '신한은행',
        '김철수',
        '1101234566789',
      );

      const accounts = stubRepo.getInsertedAccounts();
      expect(accounts[0].displayNumber).toBe('6789');
    });

    it('최소 길이(8자리) 계좌번호도 끝 4자리를 올바르게 추출한다', async () => {
      await service.createAccountInfo(
        'user-1',
        '우리은행',
        '박영희',
        '12345678',
      );

      const accounts = stubRepo.getInsertedAccounts();
      expect(accounts[0].displayNumber).toBe('5678');
    });

    it('등록 후 조회하면 정보가 일치한다', async () => {
      await service.createAccountInfo(
        'user-1',
        '국민은행',
        '홍길동',
        '12345678901234',
      );

      const result = await service.getAccountInfo('user-1');

      expect(result).not.toBeNull();
      expect(result!.accountBank).toBe('국민은행');
      expect(result!.accountName).toBe('홍길동');
      expect(result!.displayNumber).toBe('1234');
      expect(result!.accountNumberLength).toBe(14);
    });

    describe('클라이언트 암호화 입력', () => {
      it('암호문(344자 base64)을 받으면 그대로 저장하고 displayNumber는 복호화된 값에서 추출한다', async () => {
        const ciphertext = encryptWithPublicKey('12345678901234');
        expect(ciphertext.length).toBe(344);

        const result = await service.createAccountInfo(
          'user-1',
          '국민은행',
          '홍길동',
          ciphertext,
        );

        expect(result.success).toBe(true);

        const accounts = stubRepo.getInsertedAccounts();
        expect(accounts).toHaveLength(1);
        expect(accounts[0].accountNumber).toBe(ciphertext);
        expect(accounts[0].displayNumber).toBe('1234');
      });

      it('암호문으로 등록 후 조회하면 평문 등록과 동일한 결과가 나온다', async () => {
        const ciphertext = encryptWithPublicKey('1101234566789');

        await service.createAccountInfo(
          'user-1',
          '신한은행',
          '김철수',
          ciphertext,
        );

        const result = await service.getAccountInfo('user-1');

        expect(result).not.toBeNull();
        expect(result!.accountBank).toBe('신한은행');
        expect(result!.accountName).toBe('김철수');
        expect(result!.displayNumber).toBe('6789');
        expect(result!.accountNumberLength).toBe(13);
      });

      it('최소 길이(8자리) 평문을 암호화한 입력도 정상 처리한다', async () => {
        const ciphertext = encryptWithPublicKey('12345678');

        await service.createAccountInfo(
          'user-1',
          '우리은행',
          '박영희',
          ciphertext,
        );

        const accounts = stubRepo.getInsertedAccounts();
        expect(accounts[0].displayNumber).toBe('5678');
      });

      it('복호화 불가능한 344자 base64 입력은 BadRequestException을 던진다', async () => {
        // 256바이트짜리 랜덤 → base64 344자 (이 키로 복호화 불가)
        const garbage = crypto.randomBytes(256).toString('base64');
        expect(garbage.length).toBe(344);

        await expect(
          service.createAccountInfo('user-1', '국민은행', '홍길동', garbage),
        ).rejects.toThrow(/Invalid encrypted account number/);
      });

      it('복호화는 성공했지만 8~20자리 숫자 형식이 아니면 BadRequestException을 던진다', async () => {
        const ciphertext = encryptWithPublicKey('not-a-number-abc');

        await expect(
          service.createAccountInfo('user-1', '국민은행', '홍길동', ciphertext),
        ).rejects.toThrow(/not a valid account number/);
      });

      it('복호화 결과가 너무 짧으면(7자리 이하) BadRequestException을 던진다', async () => {
        const ciphertext = encryptWithPublicKey('1234567');

        await expect(
          service.createAccountInfo('user-1', '국민은행', '홍길동', ciphertext),
        ).rejects.toThrow(/not a valid account number/);
      });

      it('복호화 결과가 너무 길면(21자리 이상) BadRequestException을 던진다', async () => {
        const ciphertext = encryptWithPublicKey('123456789012345678901');

        await expect(
          service.createAccountInfo('user-1', '국민은행', '홍길동', ciphertext),
        ).rejects.toThrow(/not a valid account number/);
      });
    });
  });
});
