import type { SignedUrlResult } from './interfaces/storage-service.interface';
import type { IStorageService } from './interfaces/storage-service.interface';

export class StubStorageService implements IStorageService {
  private lastGeneratedPath: string | null = null;
  private shouldFail = false;

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  getLastGeneratedPath(): string | null {
    return this.lastGeneratedPath;
  }

  clear(): void {
    this.lastGeneratedPath = null;
    this.shouldFail = false;
  }

  generateSignedUploadUrl(
    bucket: string,
    path: string,
    contentType: string = 'image/jpeg',
    _expiresInSeconds: number = 3600,
  ): Promise<SignedUrlResult> {
    if (this.shouldFail) {
      return Promise.reject(new Error('Storage service failure'));
    }

    this.lastGeneratedPath = path;
    return Promise.resolve({
      url: `https://storage.googleapis.com/signed/${bucket}/${path}?contentType=${contentType}`,
    });
  }

  getPublicUrl(bucket: string, path: string): string {
    return `https://storage.googleapis.com/${bucket}/${path}`;
  }
}
