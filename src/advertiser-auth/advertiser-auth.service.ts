import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import type { IAdvertiserAuthRepository } from './interfaces/advertiser-auth-repository.interface';
import { ADVERTISER_AUTH_REPOSITORY } from './interfaces/advertiser-auth-repository.interface';

@Injectable()
export class AdvertiserAuthService {
  constructor(
    @Inject(ADVERTISER_AUTH_REPOSITORY)
    private advertiserAuthRepository: IAdvertiserAuthRepository,
    private configService: ConfigService,
  ) {}

  async login(
    loginId: string,
    password: string,
  ): Promise<{ accessToken: string; companyName: string }> {
    const advertiser =
      await this.advertiserAuthRepository.findByLoginId(loginId);

    if (!advertiser) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      advertiser.password_hash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    const secret = this.configService.get<string>('advertiser.jwtSecret');
    const accessToken = jwt.sign(
      {
        advertiserId: advertiser.id,
        companyName: advertiser.company_name,
      },
      secret!,
      { expiresIn: '24h' },
    );

    return {
      accessToken,
      companyName: advertiser.company_name,
    };
  }

  async findAllAdvertisers(): Promise<
    { id: number; loginId: string; companyName: string; createdAt?: string }[]
  > {
    const advertisers = await this.advertiserAuthRepository.findAll();
    return advertisers.map((a) => ({
      id: a.id,
      loginId: a.login_id,
      companyName: a.company_name,
    }));
  }

  async createAdvertiser(
    loginId: string,
    password: string,
    companyName: string,
  ): Promise<{ id: number; loginId: string; companyName: string }> {
    const existing =
      await this.advertiserAuthRepository.findByLoginId(loginId);
    if (existing) {
      throw new BadRequestException('Login ID already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const advertiser = await this.advertiserAuthRepository.create(
      loginId,
      passwordHash,
      companyName,
    );

    return {
      id: advertiser.id,
      loginId: advertiser.login_id,
      companyName: advertiser.company_name,
    };
  }
}
