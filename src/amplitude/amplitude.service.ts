import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amplitude from '@amplitude/analytics-node';

export interface AmplitudeEventProperties {
  [key: string]: string | number | boolean | null;
}

@Injectable()
export class AmplitudeService implements OnModuleDestroy {
  private readonly logger = new Logger(AmplitudeService.name);
  private initialized = false;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('amplitude.apiKey');
    if (apiKey) {
      amplitude.init(apiKey, {
        useBatch: true,
        flushQueueSize: 100,
        flushIntervalMillis: 30000,
      });
      this.initialized = true;
      this.logger.log('Amplitude 초기화 완료');
    } else {
      this.logger.warn('AMPLITUDE_API_KEY가 설정되지 않아 이벤트가 전송되지 않습니다.');
    }
  }

  track(
    eventType: string,
    userId: string,
    eventProperties?: AmplitudeEventProperties,
  ): void {
    if (!this.initialized) {
      return;
    }

    amplitude.track(eventType, eventProperties, { user_id: userId });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.initialized) {
      await amplitude.flush();
    }
  }
}
