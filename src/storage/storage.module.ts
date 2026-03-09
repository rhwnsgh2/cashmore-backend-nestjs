import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageAppService } from './storage.service';
import { GcsStorageService } from './gcs-storage.service';
import { STORAGE_SERVICE } from './interfaces/storage-service.interface';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StorageController],
  providers: [
    StorageAppService,
    {
      provide: STORAGE_SERVICE,
      useClass: GcsStorageService,
    },
  ],
  exports: [StorageAppService],
})
export class StorageModule {}
