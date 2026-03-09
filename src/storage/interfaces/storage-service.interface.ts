export interface SignedUrlResult {
  url: string;
  fields?: Record<string, string>;
}

export interface IStorageService {
  generateSignedUploadUrl(
    bucket: string,
    path: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUrlResult>;

  getPublicUrl(bucket: string, path: string): string;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
