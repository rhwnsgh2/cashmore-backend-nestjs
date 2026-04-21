import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

function createService(isProd = true): MetricsService {
  const configService = {
    get: () => (isProd ? 'production' : 'development'),
  } as unknown as ConfigService;
  return new MetricsService(configService);
}

describe('MetricsService (aggregated EMF)', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let service: MetricsService;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    service = createService(true);
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
    writeSpy.mockRestore();
  });

  function flushedLogs(): any[] {
    return writeSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((s) => s.startsWith('{'))
      .map((s) => JSON.parse(s));
  }

  it('recordRequest 호출만으로는 EMF 로그를 쓰지 않는다', () => {
    service.recordRequest('GET /user/info', 50, 200);
    service.recordRequest('GET /user/info', 70, 200);

    expect(flushedLogs()).toHaveLength(0);
  });

  it('shutdown 시 버퍼가 비워지고 endpoint×statusGroup 별로 집계 로그를 한 번씩 낸다', async () => {
    service.recordRequest('GET /user/info', 50, 200);
    service.recordRequest('GET /user/info', 70, 200);
    service.recordRequest('GET /user/info', 100, 500);
    service.recordRequest('GET /point/total', 30, 200);

    await service.onApplicationShutdown();

    const logs = flushedLogs();
    expect(logs).toHaveLength(3);

    const byKey = new Map(
      logs.map((l) => [`${l.Endpoint}|${l.StatusCode}`, l]),
    );

    const userInfo2xx = byKey.get('GET /user/info|2xx');
    expect(userInfo2xx.RequestCount).toBe(2);
    expect(userInfo2xx.StatusCodeCount).toBe(2);
    expect(userInfo2xx.ResponseTime).toEqual({
      Count: 2,
      Sum: 120,
      Min: 50,
      Max: 70,
    });

    const userInfo5xx = byKey.get('GET /user/info|5xx');
    expect(userInfo5xx.RequestCount).toBe(1);
    expect(userInfo5xx.ResponseTime).toEqual({
      Count: 1,
      Sum: 100,
      Min: 100,
      Max: 100,
    });

    const pointTotal = byKey.get('GET /point/total|2xx');
    expect(pointTotal.RequestCount).toBe(1);
    expect(pointTotal.ResponseTime.Sum).toBe(30);
  });

  it('flush 후 같은 key로 recordRequest 하면 새 버킷으로 다시 쌓인다', async () => {
    service.recordRequest('GET /user/info', 50, 200);
    await service.onApplicationShutdown();

    writeSpy.mockClear();

    const again = createService(true);
    again.recordRequest('GET /user/info', 200, 200);
    await again.onApplicationShutdown();

    const logs = writeSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((s) => s.startsWith('{'))
      .map((s) => JSON.parse(s));

    expect(logs).toHaveLength(1);
    expect(logs[0].RequestCount).toBe(1);
    expect(logs[0].ResponseTime.Sum).toBe(200);
  });

  it('UUID와 숫자 경로 파라미터를 정규화한다', async () => {
    service.recordRequest(
      'GET /every_receipt/550e8400-e29b-41d4-a716-446655440000',
      40,
      200,
    );
    service.recordRequest('DELETE /user/12345', 20, 204);

    await service.onApplicationShutdown();

    const endpoints = flushedLogs().map((l) => l.Endpoint);
    expect(endpoints).toContain('GET /every_receipt/:id');
    expect(endpoints).toContain('DELETE /user/:id');
  });
});
