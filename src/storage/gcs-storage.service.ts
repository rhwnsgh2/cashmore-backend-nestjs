import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import {
  IStorageService,
  SignedUrlResult,
} from './interfaces/storage-service.interface';

@Injectable()
export class GcsStorageService implements IStorageService {
  private storage: Storage;

  constructor(private configService: ConfigService) {
    this.storage = new Storage({
      projectId: this.configService.get<string>('gcs.projectId'),
      credentials: {
        client_email: this.configService.get<string>('gcs.clientEmail'),
        private_key: this.configService
          .get<string>('gcs.privateKey')
          ?.replace(/\\n/g, '\n'),
      },
    });
  }

  async generateSignedUploadUrl(
    bucket: string,
    path: string,
    contentType: string = 'image/jpeg',
    expiresInSeconds: number = 3600,
  ): Promise<SignedUrlResult> {
    const bucketRef = this.storage.bucket(bucket);
    const fileRef = bucketRef.file(path);

    const [url] = await fileRef.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInSeconds * 1000,
      contentType,
      extensionHeaders: {
        'x-goog-acl': 'public-read',
      },
    });

    return { url };
  }

  getPublicUrl(bucket: string, path: string): string {
    return `https://storage.googleapis.com/${bucket}/${path}`;
  }
}
