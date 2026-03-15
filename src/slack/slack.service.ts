import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SlackService {
  private readonly bugWebhookUrl: string | undefined;
  private readonly invitationWebhookUrl: string | undefined;
  constructor(private configService: ConfigService) {
    this.bugWebhookUrl = this.configService.get<string>(
      'SLACK_BUG_WEBHOOK_URL',
    );
    this.invitationWebhookUrl = this.configService.get<string>(
      'SLACK_INVITATION_WEBHOOK_URL',
    );
  }

  private isDisabled(): boolean {
    const env = process.env.NODE_ENV;
    return env === 'test' || env === 'development';
  }

  async reportBugToSlack(contents: string): Promise<void> {
    if (this.isDisabled() || !this.bugWebhookUrl) {
      return;
    }

    try {
      await fetch(this.bugWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: contents }),
      });
    } catch (error) {
      console.error(
        '[Slack] Failed to send bug report:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async reportToInvitationNoti(title: string, userId?: string): Promise<void> {
    if (this.isDisabled() || !this.invitationWebhookUrl) {
      return;
    }

    try {
      const text = userId ? `${title} ${userId}` : title;
      await fetch(this.invitationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      console.error(
        '[Slack] Failed to send invitation notification:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async reportDeeplinkClick(info: {
    ip: string;
    userAgent: string;
    params: Record<string, string>;
    path: string;
    os: string;
    osVersion: string;
    platformVersion?: string;
    model?: string;
    screenWidth?: number;
    screenHeight?: number;
  }): Promise<void> {
    if (this.isDisabled() || !this.invitationWebhookUrl) {
      return;
    }

    try {
      const kstTime = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      });
      const lines = [
        '🔗 딥링크 클릭 감지',
        `• IP: ${info.ip}`,
        `• OS: ${info.os} ${info.osVersion}`,
        `• 경로: ${info.path}`,
        `• 파라미터: ${JSON.stringify(info.params)}`,
      ];
      if (info.platformVersion) {
        lines.push(`• Platform Version: ${info.platformVersion}`);
      }
      if (info.model) {
        lines.push(`• Model: ${info.model}`);
      }
      if (info.screenWidth != null && info.screenHeight != null) {
        lines.push(`• Screen: ${info.screenWidth}x${info.screenHeight}`);
      }
      lines.push(`• 시각: ${kstTime}`);
      const text = lines.join('\n');

      await fetch(this.invitationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      console.error(
        '[Slack] Failed to send deeplink click report:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async reportDeeplinkMatchAttempt(info: {
    ip: string;
    os: string;
    osVersion: string;
  }): Promise<void> {
    if (this.isDisabled() || !this.invitationWebhookUrl) {
      return;
    }

    try {
      const kstTime = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      });
      const text = [
        '🔍 딥링크 매칭 시도',
        `• IP: ${info.ip}`,
        `• OS: ${info.os} ${info.osVersion}`,
        `• 시각: ${kstTime}`,
      ].join('\n');

      await fetch(this.invitationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      console.error(
        '[Slack] Failed to send deeplink match attempt report:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async reportDeeplinkMatchMiss(info: {
    ip: string;
    os: string;
    osVersion: string;
    reason: string;
    score?: number;
  }): Promise<void> {
    if (this.isDisabled() || !this.invitationWebhookUrl) {
      return;
    }

    try {
      const kstTime = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      });
      const lines = [
        '❌ 딥링크 매칭 실패',
        `• IP: ${info.ip}`,
        `• OS: ${info.os} ${info.osVersion}`,
        `• 사유: ${info.reason}`,
      ];
      if (info.score != null) {
        lines.push(`• Score: ${info.score}`);
      }
      lines.push(`• 시각: ${kstTime}`);
      const text = lines.join('\n');

      await fetch(this.invitationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      console.error(
        '[Slack] Failed to send deeplink match miss report:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async reportDeeplinkMatch(info: {
    ip: string;
    os: string;
    osVersion: string;
    path: string;
    params: Record<string, string>;
    score: number;
    details: string[];
  }): Promise<void> {
    if (this.isDisabled() || !this.invitationWebhookUrl) {
      return;
    }

    try {
      const kstTime = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      });
      const confidence =
        info.score === 0 ? '⚠️ LOW' : info.score >= 3 ? '🟢 HIGH' : '🟡 MED';
      const text = [
        `✅ 딥링크 매칭 성공 [${confidence}]`,
        `• IP: ${info.ip}`,
        `• OS: ${info.os} ${info.osVersion}`,
        `• 경로: ${info.path}`,
        `• 파라미터: ${JSON.stringify(info.params)}`,
        `• Score: ${info.score}`,
        `• 시그널: ${info.details.join(' | ')}`,
        `• 시각: ${kstTime}`,
      ].join('\n');

      await fetch(this.invitationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      console.error(
        '[Slack] Failed to send deeplink match report:',
        error instanceof Error ? error.message : error,
      );
    }
  }
}
