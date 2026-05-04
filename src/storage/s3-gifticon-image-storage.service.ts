import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { IGifticonImageStorage } from './interfaces/gifticon-image-storage.interface';

@Injectable()
export class S3GifticonImageStorage implements IGifticonImageStorage {
  private readonly logger = new Logger(S3GifticonImageStorage.name);
  private readonly client: S3Client;

  constructor() {
    const region = process.env.GIFTICON_IMAGES_REGION ?? 'ap-northeast-2';
    this.client = new S3Client({ region });
  }

  async uploadFromUrl(path: string, sourceUrl: string): Promise<string> {
    const bucket = process.env.GIFTICON_IMAGES_BUCKET;
    const publicHost = process.env.GIFTICON_IMAGES_PUBLIC_HOST;
    if (!bucket || !publicHost) {
      throw new Error(
        'GIFTICON_IMAGES_BUCKET / GIFTICON_IMAGES_PUBLIC_HOST not configured',
      );
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch source image: ${res.status} ${sourceUrl}`,
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const publicUrl = `https://${publicHost}/${path}`;
    this.logger.log(
      `uploaded ${sourceUrl} -> ${publicUrl} (${buffer.length} bytes, ${contentType})`,
    );
    return publicUrl;
  }
}
