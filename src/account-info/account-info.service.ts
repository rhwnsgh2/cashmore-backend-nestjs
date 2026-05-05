import * as crypto from 'crypto';
import {
  BadRequestException,
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
  private readonly privateKeyObject: crypto.KeyObject;
  private readonly publicKeyObject: crypto.KeyObject;

  constructor(
    private configService: ConfigService,
    @Inject(ACCOUNT_INFO_REPOSITORY)
    private accountInfoRepository: IAccountInfoRepository,
  ) {
    const privateKeyPem =
      this.configService.get<string>('accountEncrypt.privateKey') ?? '';
    this.privateKeyObject = crypto.createPrivateKey(privateKeyPem);
    this.publicKeyObject = crypto.createPublicKey(PUBLIC_KEY);
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
    let encrypted: string;
    let plaintext: string;

    // RSA-2048-OAEP 암호문은 항상 256바이트 → base64 344자 고정.
    // 평문(8~20자리 숫자)과 길이가 겹치지 않으므로 길이로 안전하게 분기.
    if (accountNumber.length === 344) {
      encrypted = accountNumber;
      try {
        plaintext = this.decryptAccountNumber(encrypted);
      } catch {
        throw new BadRequestException('Invalid encrypted account number');
      }
      if (!/^[0-9]{8,20}$/.test(plaintext)) {
        throw new BadRequestException(
          'Decrypted value is not a valid account number',
        );
      }
    } else {
      plaintext = accountNumber;
      encrypted = this.encryptAccountNumber(plaintext);

      const decrypted = this.decryptAccountNumber(encrypted);
      if (decrypted !== plaintext) {
        throw new InternalServerErrorException(
          'Failed to encrypt account number',
        );
      }
    }

    await this.accountInfoRepository.create({
      userId,
      accountBank: bank,
      accountNumber: encrypted,
      accountUserName: accountHolder,
      displayNumber: plaintext.slice(-4),
    });

    return { success: true, message: '계좌 정보가 등록되었습니다.' };
  }

  private encryptAccountNumber(text: string): string {
    const encrypted = crypto.publicEncrypt(
      {
        key: this.publicKeyObject,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      Buffer.from(text, 'utf-8'),
    );

    return encrypted.toString('base64');
  }

  async getBulkAccountInfo(userIds: string[]): Promise<
    {
      userId: string;
      accountBank: string;
      accountNumber: string;
      accountUserName: string;
    }[]
  > {
    const accounts =
      await this.accountInfoRepository.findLatestBulkByUserIds(userIds);

    return accounts.map((account) => ({
      userId: account.userId,
      accountBank: account.accountBank,
      accountNumber: this.decryptAccountNumber(account.accountNumber),
      accountUserName: account.accountUserName,
    }));
  }

  async getBulkAccountInfoName(userIds: string[]): Promise<
    {
      userId: string;
      accountBank: string;
      accountUserName: string;
    }[]
  > {
    const accounts =
      await this.accountInfoRepository.findLatestBulkByUserIds(userIds);

    return accounts.map((account) => ({
      userId: account.userId,
      accountBank: account.accountBank,
      accountUserName: account.accountUserName,
    }));
  }

  private decryptAccountNumber(encryptedBase64: string): string {
    return crypto
      .privateDecrypt(
        {
          key: this.privateKeyObject,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha1',
        },
        Buffer.from(encryptedBase64, 'base64'),
      )
      .toString('utf-8');
  }
}
