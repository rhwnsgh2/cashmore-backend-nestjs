import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PointBatchController } from './point-batch.controller';
import { PointBatchService } from './point-batch.service';
import { POINT_BATCH_REPOSITORY } from './interfaces/point-batch-repository.interface';
import {
  PgPointBatchRepository,
  PG_POOL,
} from './repositories/pg-point-batch.repository';

@Module({
  controllers: [PointBatchController],
  providers: [
    PointBatchService,
    {
      provide: PG_POOL,
      useFactory: (configService: ConfigService) => {
        return new Pool({
          connectionString: configService.get<string>('SUPABASE_DB_URL'),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: POINT_BATCH_REPOSITORY,
      useClass: PgPointBatchRepository,
    },
  ],
})
export class PointBatchModule {}
