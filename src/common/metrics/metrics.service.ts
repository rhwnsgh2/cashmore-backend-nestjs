import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly namespace = 'Cashmore/API';
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    this.logger.log(
      `MetricsService initialized with EMF (production: ${this.isProduction})`,
    );
  }

  recordRequest(endpoint: string, responseTime: number, statusCode: number) {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;

    const emfLog = {
      _aws: {
        Timestamp: Date.now(),
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
      Endpoint: normalizedEndpoint,
      StatusCode: statusGroup,
      RequestCount: 1,
      ResponseTime: responseTime,
      StatusCodeCount: 1,
    };

    if (this.isProduction) {
      process.stdout.write(JSON.stringify(emfLog) + '\n');
    } else {
      this.logger.debug(
        `[Dev EMF] ${normalizedEndpoint} ${statusGroup} ${responseTime}ms`,
      );
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
