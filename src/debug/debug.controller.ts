import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import * as v8 from 'v8';
import * as fs from 'fs';

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
  @ApiOperation({ summary: 'GC 강제 실행' })
  forceGC() {
    const before = process.memoryUsage();

    if (global.gc) {
      global.gc();
      const after = process.memoryUsage();
      return {
        success: true,
        freed: Math.round((before.rss - after.rss) / 1024 / 1024),
        unit: 'MB',
      };
    }

    return {
      success: false,
      error: 'GC not exposed. Run node with --expose-gc flag',
    };
  }

  @Post('heap-snapshot')
  @ApiOperation({ summary: '힙 스냅샷 생성' })
  generateHeapSnapshot() {
    const filename = `/tmp/heap-${Date.now()}.heapsnapshot`;
    v8.writeHeapSnapshot(filename);

    const stats = fs.statSync(filename);
    return {
      success: true,
      filename,
      size: `${Math.round(stats.size / 1024 / 1024)} MB`,
      message: 'Use ECS Exec to retrieve the file',
    };
  }
}
