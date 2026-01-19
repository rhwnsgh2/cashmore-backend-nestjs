import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum,
} from '@aws-sdk/client-cloudwatch';

interface EndpointMetrics {
  count: number;
  totalResponseTime: number;
  statusCodes: Map<number, number>;
}

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly metrics = new Map<string, EndpointMetrics>();
  private readonly cloudwatch: CloudWatchClient;
  private readonly namespace = 'Cashmore/API';
  private readonly flushInterval: NodeJS.Timeout;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    this.cloudwatch = new CloudWatchClient({
      region: 'ap-northeast-2',
    });

    // 1분마다 CloudWatch로 전송
    this.flushInterval = setInterval(
      () => {
        this.flushMetrics();
      },
      60 * 1000, // 1분
    );

    this.logger.log(
      `MetricsService initialized (production: ${this.isProduction})`,
    );
  }

  onModuleDestroy() {
    clearInterval(this.flushInterval);
    // 종료 전 마지막 flush
    this.flushMetrics();
  }

  recordRequest(endpoint: string, responseTime: number, statusCode: number) {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    if (!this.metrics.has(normalizedEndpoint)) {
      this.metrics.set(normalizedEndpoint, {
        count: 0,
        totalResponseTime: 0,
        statusCodes: new Map(),
      });
    }

    const metric = this.metrics.get(normalizedEndpoint)!;
    metric.count += 1;
    metric.totalResponseTime += responseTime;
    metric.statusCodes.set(
      statusCode,
      (metric.statusCodes.get(statusCode) || 0) + 1,
    );
  }

  private normalizeEndpoint(endpoint: string): string {
    // UUID, 숫자 ID 등을 :id로 치환하여 엔드포인트 그룹화
    return endpoint
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      )
      .replace(/\/\d+/g, '/:id');
  }

  private async flushMetrics() {
    if (this.metrics.size === 0) {
      return;
    }

    const metricData: MetricDatum[] = [];
    const timestamp = new Date();

    for (const [endpoint, data] of this.metrics.entries()) {
      // 요청 수
      metricData.push({
        MetricName: 'RequestCount',
        Dimensions: [{ Name: 'Endpoint', Value: endpoint }],
        Value: data.count,
        Unit: 'Count',
        Timestamp: timestamp,
      });

      // 평균 응답 시간
      if (data.count > 0) {
        metricData.push({
          MetricName: 'ResponseTime',
          Dimensions: [{ Name: 'Endpoint', Value: endpoint }],
          Value: data.totalResponseTime / data.count,
          Unit: 'Milliseconds',
          Timestamp: timestamp,
        });
      }

      // 상태 코드별 카운트
      for (const [statusCode, count] of data.statusCodes.entries()) {
        const statusGroup = `${Math.floor(statusCode / 100)}xx`;
        metricData.push({
          MetricName: 'StatusCodeCount',
          Dimensions: [
            { Name: 'Endpoint', Value: endpoint },
            { Name: 'StatusCode', Value: statusGroup },
          ],
          Value: count,
          Unit: 'Count',
          Timestamp: timestamp,
        });
      }
    }

    // 메트릭 초기화
    this.metrics.clear();

    // 프로덕션에서만 CloudWatch로 전송
    if (this.isProduction && metricData.length > 0) {
      try {
        // CloudWatch는 한 번에 최대 1000개 메트릭만 전송 가능
        const chunks = this.chunkArray(metricData, 1000);

        for (const chunk of chunks) {
          await this.cloudwatch.send(
            new PutMetricDataCommand({
              Namespace: this.namespace,
              MetricData: chunk,
            }),
          );
        }

        this.logger.debug(`Sent ${metricData.length} metrics to CloudWatch`);
      } catch (error) {
        this.logger.error('Failed to send metrics to CloudWatch', error);
      }
    } else if (!this.isProduction && metricData.length > 0) {
      this.logger.debug(
        `[Dev] Would send ${metricData.length} metrics: ${JSON.stringify(metricData.slice(0, 3))}...`,
      );
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
