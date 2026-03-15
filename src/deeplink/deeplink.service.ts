import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEEPLINK_REPOSITORY,
  type IDeeplinkRepository,
} from './interfaces/deeplink-repository.interface';
import { ClickRequestDto } from './dto/click.dto';
import { MatchRequestDto } from './dto/match.dto';
import {
  generateFingerprintFromUA,
  generateFingerprintFromApp,
  parseUserAgent,
} from './utils/fingerprint';
import { SlackService } from '../slack/slack.service';

@Injectable()
export class DeeplinkService {
  private readonly logger = new Logger(DeeplinkService.name);

  constructor(
    @Inject(DEEPLINK_REPOSITORY)
    private deeplinkRepository: IDeeplinkRepository,
    private slackService: SlackService,
  ) {}

  /** 웹에서 클릭 시 fingerprint + 파라미터를 저장한다 */
  async recordClick(ip: string, userAgent: string, dto: ClickRequestDto) {
    const fingerprint = generateFingerprintFromUA(ip, userAgent);

    await this.deeplinkRepository.saveClick(fingerprint, {
      params: dto.params,
      path: dto.path,
      createdAt: new Date().toISOString(),
    });

    const { os, osVersion } = parseUserAgent(userAgent);

    this.slackService
      .reportDeeplinkClick({
        ip,
        userAgent,
        params: dto.params,
        path: dto.path,
        fingerprint,
        os,
        osVersion,
      })
      .catch(() => {});

    this.logger.log(
      `Click recorded: fingerprint=${fingerprint.slice(0, 8)}..., path=${dto.path}`,
    );

    return { recorded: true };
  }

  /** 앱 첫 실행 시 fingerprint로 매칭한다 */
  async matchFingerprint(ip: string, dto: MatchRequestDto) {
    const fingerprint = generateFingerprintFromApp(ip, dto.os, dto.osVersion);

    const data =
      await this.deeplinkRepository.findAndDeleteByFingerprint(fingerprint);

    if (!data) {
      this.logger.log(`Match miss: fingerprint=${fingerprint.slice(0, 8)}...`);
      return { matched: false };
    }

    this.logger.log(
      `Match hit: fingerprint=${fingerprint.slice(0, 8)}..., path=${data.path}`,
    );

    return {
      matched: true,
      params: data.params,
      path: data.path,
    };
  }
}
