import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEEPLINK_REPOSITORY,
  type IDeeplinkRepository,
} from './interfaces/deeplink-repository.interface';
import { ClickRequestDto } from './dto/click.dto';
import { MatchRequestDto } from './dto/match.dto';
import {
  parseUserAgent,
  normalizeVersion,
  scoreMatch,
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

  /** 웹에서 클릭 시 IP를 키로 시그널 + 파라미터를 저장한다 */
  async recordClick(ip: string, userAgent: string, dto: ClickRequestDto) {
    const { os, osVersion: uaVersion } = parseUserAgent(userAgent);

    // Client Hints platformVersion이 있으면 정규화하여 사용, 없으면 UA 파싱 버전 사용
    const osVersion =
      dto.platformVersion && os !== 'unknown'
        ? normalizeVersion(os, dto.platformVersion)
        : uaVersion;

    await this.deeplinkRepository.saveClick(ip, {
      os,
      osVersion,
      screenWidth: dto.screenWidth,
      screenHeight: dto.screenHeight,
      model: dto.model,
      params: dto.params,
      path: dto.path,
      createdAt: new Date().toISOString(),
    });

    this.slackService
      .reportDeeplinkClick({
        ip,
        userAgent,
        params: dto.params,
        path: dto.path,
        os,
        osVersion,
        platformVersion: dto.platformVersion,
        model: dto.model,
        screenWidth: dto.screenWidth,
        screenHeight: dto.screenHeight,
      })
      .catch(() => {});

    this.logger.log(`Click recorded: ip=${ip}, path=${dto.path}`);

    return { recorded: true };
  }

  /** 앱 첫 실행 시 IP + 시그널로 매칭한다 */
  async matchClick(ip: string, dto: MatchRequestDto) {
    this.slackService
      .reportDeeplinkMatchAttempt({
        ip,
        os: dto.os,
        osVersion: dto.osVersion,
      })
      .catch(() => {});

    const clickData = await this.deeplinkRepository.findAndDeleteByIp(ip);

    if (!clickData) {
      this.logger.log(`Match miss: ip=${ip}, no click data found`);

      this.slackService
        .reportDeeplinkMatchMiss({
          ip,
          os: dto.os,
          osVersion: dto.osVersion,
          reason: 'No click data found for IP',
        })
        .catch(() => {});

      return { matched: false };
    }

    // Score the match
    const result = scoreMatch(
      {
        os: clickData.os,
        osVersion: clickData.osVersion,
        screenWidth: clickData.screenWidth,
        screenHeight: clickData.screenHeight,
        model: clickData.model,
      },
      {
        os: dto.os,
        osVersion: dto.osVersion,
        screenWidth: dto.screenWidth,
        screenHeight: dto.screenHeight,
        model: dto.model,
      },
    );

    if (!result.matched) {
      // Score 실패 시 데이터 복원 (다른 매칭 시도를 위해)
      await this.deeplinkRepository.restoreClick(ip, clickData);

      this.logger.log(
        `Match miss: ip=${ip}, score=${result.score}, details=${result.details.join(', ')}`,
      );

      this.slackService
        .reportDeeplinkMatchMiss({
          ip,
          os: dto.os,
          osVersion: dto.osVersion,
          reason: result.details.join(', '),
          score: result.score,
        })
        .catch(() => {});

      return { matched: false };
    }

    this.logger.log(
      `Match hit: ip=${ip}, score=${result.score}, path=${clickData.path}, details=${result.details.join(', ')}`,
    );

    // Low confidence warning
    if (result.score === 0) {
      this.logger.warn(`Low confidence match: ip=${ip}, IP+OS only`);
    }

    this.slackService
      .reportDeeplinkMatch({
        ip,
        os: dto.os,
        osVersion: dto.osVersion,
        path: clickData.path,
        params: clickData.params,
        score: result.score,
        details: result.details,
      })
      .catch(() => {});

    return {
      matched: true,
      params: clickData.params,
      path: clickData.path,
    };
  }
}
