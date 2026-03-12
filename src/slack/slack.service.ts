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
}
