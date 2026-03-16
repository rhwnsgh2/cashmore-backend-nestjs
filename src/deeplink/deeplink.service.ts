import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
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
import { InvitationService } from '../invitation/invitation.service';
import { AmplitudeService } from '../amplitude/amplitude.service';

@Injectable()
export class DeeplinkService {
  private readonly logger = new Logger(DeeplinkService.name);

  constructor(
    @Inject(DEEPLINK_REPOSITORY)
    private deeplinkRepository: IDeeplinkRepository,
    private slackService: SlackService,
    private invitationService: InvitationService,
    private amplitudeService: AmplitudeService,
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
    const clickData = await this.deeplinkRepository.findAndDeleteByIp(ip);

    if (!clickData) {
      this.logger.log(`Match miss: ip=${ip}, no click data found`);
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

    // Amplitude: track match success (fire-and-forget)
    const anonUserId = `anon_${createHash('sha256').update(ip).digest('hex').substring(0, 8)}`;
    const confidence =
      result.score >= 2 ? 'HIGH' : result.score >= 1 ? 'MED' : 'LOW';
    const matchDurationSec = Math.round(
      (Date.now() - new Date(clickData.createdAt).getTime()) / 1000,
    );
    this.amplitudeService.track('deeplink_match_success', anonUserId, {
      score: result.score,
      confidence,
      code: clickData.params.code ?? null,
      receiptId: clickData.params.receiptId
        ? Number(clickData.params.receiptId)
        : null,
      matchDurationSec,
      os: dto.os,
      osVersion: dto.osVersion,
    });
    // TODO: deeplink_signup 이벤트는 유저 생성 시점(auth 모듈)에서 트래킹 필요

    // receiptId가 있으면 만료 여부 확인
    let receiptValid: boolean | undefined;
    if (clickData.params.receiptId) {
      const receiptId = Number(clickData.params.receiptId);
      const expired = await this.invitationService.isReceiptExpired(receiptId);
      receiptValid = !expired;
    }

    return {
      matched: true,
      params: clickData.params,
      path: clickData.path,
      ...(receiptValid !== undefined && { receiptValid }),
    };
  }
}
