import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Bucket {
  count: number;
  rtSum: number;
  rtMin: number;
  rtMax: number;
}

const FLUSH_INTERVAL_MS = 60_000;

@Injectable()
export class MetricsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MetricsService.name);
  private readonly namespace = 'Cashmore/API';
  private readonly isProduction: boolean;
  private buckets = new Map<string, Bucket>();
  private flushTimer?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    this.logger.log(
      `MetricsService initialized with EMF (production: ${this.isProduction})`,
    );
  }

  onModuleInit() {
    this.flushTimer = setInterval(
      () => this.flush(),
      FLUSH_INTERVAL_MS,
    ).unref();
  }

  async onApplicationShutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flush();
  }

  recordRequest(endpoint: string, responseTime: number, statusCode: number) {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    const key = `${normalizedEndpoint}\u0000${statusGroup}`;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        count: 0,
        rtSum: 0,
        rtMin: responseTime,
        rtMax: responseTime,
      };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    bucket.rtSum += responseTime;
    if (responseTime < bucket.rtMin) bucket.rtMin = responseTime;
    if (responseTime > bucket.rtMax) bucket.rtMax = responseTime;
  }

  private flush() {
    if (this.buckets.size === 0) return;

    const snapshot = this.buckets;
    this.buckets = new Map();
    const timestamp = Date.now();

    for (const [key, bucket] of snapshot) {
      const [endpoint, statusGroup] = key.split('\u0000');
      const emfLog = {
        _aws: {
          Timestamp: timestamp,
          CloudWatchMetrics: [
            {
              Namespace: this.namespace,
              Dimensions: [['Endpoint'], ['Endpoint', 'StatusCode']],
              Metrics: [
                { Name: 'RequestCount', Unit: 'Count' },
                { Name: 'ResponseTime', Unit: 'Milliseconds' },
                { Name: 'StatusCodeCount', Unit: 'Count' },
              ],
            },
          ],
        },
        Endpoint: endpoint,
        StatusCode: statusGroup,
        RequestCount: bucket.count,
        StatusCodeCount: bucket.count,
        ResponseTime: {
          Count: bucket.count,
          Sum: bucket.rtSum,
          Min: bucket.rtMin,
          Max: bucket.rtMax,
        },
      };

      if (this.isProduction) {
        process.stdout.write(JSON.stringify(emfLog) + '\n');
      } else {
        this.logger.debug(
          `[Dev EMF] ${endpoint} ${statusGroup} count=${bucket.count} avg=${(
            bucket.rtSum / bucket.count
          ).toFixed(1)}ms max=${bucket.rtMax}ms`,
        );
      }
    }
  }

  private normalizeEndpoint(endpoint: string): string {
    return endpoint
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      )
      .replace(/\/\d+/g, '/:id');
  }
}
