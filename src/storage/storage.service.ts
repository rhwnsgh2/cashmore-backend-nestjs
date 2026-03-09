import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { IStorageService } from './interfaces/storage-service.interface';
import { STORAGE_SERVICE } from './interfaces/storage-service.interface';
import { SignedUrlResponseDto } from './dto/signed-url.dto';

@Injectable()
export class StorageAppService {
  private static readonly BUCKET = 'every-receipt';
  private static readonly EXPIRY_SECONDS = 3600;

  constructor(
    @Inject(STORAGE_SERVICE)
    private storageService: IStorageService,
  ) {}

  async generateSignedUploadUrl(
    userId: string,
    contentType: string = 'image/jpeg',
  ): Promise<SignedUrlResponseDto> {
    const timestamp = new Date().toISOString();
    const randomId = randomBytes(16).toString('hex');
    const imagePath = `${userId}/${timestamp}_${randomId}`;

    const { url, fields } = await this.storageService.generateSignedUploadUrl(
      StorageAppService.BUCKET,
      imagePath,
      contentType,
      StorageAppService.EXPIRY_SECONDS,
    );

    const publicUrl = this.storageService.getPublicUrl(
      StorageAppService.BUCKET,
      imagePath,
    );

    return {
      success: true,
      uploadUrl: url,
      uploadFields: fields,
      imagePath,
      publicUrl,
    };
  }
}
