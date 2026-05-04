import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageAppService } from './storage.service';
import { GcsStorageService } from './gcs-storage.service';
import { S3GifticonImageStorage } from './s3-gifticon-image-storage.service';
import { STORAGE_SERVICE } from './interfaces/storage-service.interface';
import { GIFTICON_IMAGE_STORAGE } from './interfaces/gifticon-image-storage.interface';
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
    {
      provide: GIFTICON_IMAGE_STORAGE,
      useClass: S3GifticonImageStorage,
    },
  ],
  exports: [StorageAppService, GIFTICON_IMAGE_STORAGE],
})
export class StorageModule {}
