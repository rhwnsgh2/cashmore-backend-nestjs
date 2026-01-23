import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

declare const Bun:
  | {
      gc: (full: boolean) => void;
      generateHeapSnapshot: (filename?: string) => string;
    }
  | undefined;

@ApiTags('Debug')
@Controller('debug')
export class DebugController {
  @Get('memory')
  @ApiOperation({ summary: '메모리 사용량 조회' })
  getMemory() {
    const usage = process.memoryUsage();
    const formatMB = (bytes: number) => Math.round(bytes / 1024 / 1024);

    return {
      rss: formatMB(usage.rss),
      heapUsed: formatMB(usage.heapUsed),
      heapTotal: formatMB(usage.heapTotal),
      external: formatMB(usage.external),
      unit: 'MB',
    };
  }

  @Post('gc')
  @ApiOperation({ summary: 'GC 강제 실행 (Bun)' })
  forceGC() {
    if (typeof Bun !== 'undefined' && Bun.gc) {
      const before = process.memoryUsage();
      Bun.gc(true);
      const after = process.memoryUsage();

      return {
        success: true,
        freed: Math.round((before.rss - after.rss) / 1024 / 1024),
        unit: 'MB',
      };
    }
    return { success: false, error: 'Bun runtime required' };
  }

  @Post('heap-snapshot')
  @ApiOperation({ summary: '힙 스냅샷 생성 (Bun)' })
  generateHeapSnapshot() {
    if (typeof Bun !== 'undefined' && Bun.generateHeapSnapshot) {
      const filename = Bun.generateHeapSnapshot();
      return {
        success: true,
        filename,
        message: 'Use ECS Exec to retrieve: aws ecs execute-command ...',
      };
    }
    return { success: false, error: 'Bun runtime required' };
  }
}
