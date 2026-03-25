import * as crypto from 'crypto';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAccountInfoRepository } from './interfaces/account-info-repository.interface';
import { ACCOUNT_INFO_REPOSITORY } from './interfaces/account-info-repository.interface';
import type { AccountInfoResponseDto } from './dto/account-info.dto';

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

@Injectable()
export class AccountInfoService {
  private readonly logger = new Logger(AccountInfoService.name);
  private readonly privateKey: string;

  constructor(
    private configService: ConfigService,
    @Inject(ACCOUNT_INFO_REPOSITORY)
    private accountInfoRepository: IAccountInfoRepository,
  ) {
    this.privateKey =
      this.configService.get<string>('accountEncrypt.privateKey') ?? '';
  }

  async getAccountInfo(userId: string): Promise<AccountInfoResponseDto | null> {
    const account = await this.accountInfoRepository.findLatestByUserId(userId);

    if (!account) {
      return null;
    }

    const accountNumber = this.decryptAccountNumber(account.accountNumber);

    return {
      accountBank: account.accountBank,
      displayNumber: account.displayNumber,
      accountNumberLength: accountNumber.length,
      accountName: account.accountUserName,
    };
  }

  async createAccountInfo(
    userId: string,
    bank: string,
    accountHolder: string,
    accountNumber: string,
  ): Promise<{ success: boolean; message: string }> {
    const encrypted = this.encryptAccountNumber(accountNumber);

    // 암호화 검증
    const decrypted = this.decryptAccountNumber(encrypted);
    if (decrypted !== accountNumber) {
      throw new InternalServerErrorException(
        'Failed to encrypt account number',
      );
    }

    await this.accountInfoRepository.create({
      userId,
      accountBank: bank,
      accountNumber: encrypted,
      accountUserName: accountHolder,
      displayNumber: accountNumber.slice(-4),
    });

    return { success: true, message: '계좌 정보가 등록되었습니다.' };
  }

  private encryptAccountNumber(text: string): string {
    const encrypted = crypto.publicEncrypt(
      {
        key: PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(text, 'utf-8'),
    );

    return encrypted.toString('base64');
  }

  private decryptAccountNumber(encryptedBase64: string): string {
    return crypto
      .privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(encryptedBase64, 'base64'),
      )
      .toString('utf-8');
  }
}
