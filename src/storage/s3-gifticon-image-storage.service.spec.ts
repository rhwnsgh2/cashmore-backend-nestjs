import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { S3GifticonImageStorage } from './s3-gifticon-image-storage.service';

describe('S3GifticonImageStorage', () => {
  let service: S3GifticonImageStorage;
  let sendMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GIFTICON_IMAGES_BUCKET = 'test-bucket';
    process.env.GIFTICON_IMAGES_REGION = 'ap-northeast-2';
    process.env.GIFTICON_IMAGES_PUBLIC_HOST = 'cdn.example.com';

    service = new S3GifticonImageStorage();

    sendMock = vi.fn().mockResolvedValue({});
    // S3Client.send를 mock
    (service as unknown as { client: { send: typeof sendMock } }).client.send =
      sendMock;

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      headers: { get: (name: string) => (name === 'content-type' ? 'image/jpeg' : null) },
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('소스 URL에서 받아 S3에 업로드 후 CloudFront URL을 반환한다', async () => {
    const url = await service.uploadFromUrl(
      'gifticon/A.jpg',
      'http://src/img.jpg',
    );

    expect(fetchMock).toHaveBeenCalledWith('http://src/img.jpg');
    expect(sendMock).toHaveBeenCalledOnce();
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'gifticon/A.jpg',
      ContentType: 'image/jpeg',
    });
    expect(Buffer.isBuffer(command.input.Body)).toBe(true);
    expect(url).toBe('https://cdn.example.com/gifticon/A.jpg');
  });

  it('content-type 헤더가 없으면 image/jpeg로 기본값', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
      headers: { get: () => null },
    });

    await service.uploadFromUrl('gifticon/B.jpg', 'http://src/B');

    const command = sendMock.mock.calls[0][0];
    expect(command.input.ContentType).toBe('image/jpeg');
  });

  it('소스 fetch 실패 시 에러를 던진다', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => null },
    });

    await expect(
      service.uploadFromUrl('gifticon/X.jpg', 'http://src/missing'),
    ).rejects.toThrow(/Failed to fetch source image: 404/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('GIFTICON_IMAGES_BUCKET 미설정 시 에러를 던진다', async () => {
    delete process.env.GIFTICON_IMAGES_BUCKET;
    const s = new S3GifticonImageStorage();
    (s as unknown as { client: { send: typeof sendMock } }).client.send =
      sendMock;

    await expect(
      s.uploadFromUrl('gifticon/A.jpg', 'http://src/img.jpg'),
    ).rejects.toThrow(/not configured/);
  });

  it('GIFTICON_IMAGES_PUBLIC_HOST 미설정 시 에러를 던진다', async () => {
    delete process.env.GIFTICON_IMAGES_PUBLIC_HOST;
    const s = new S3GifticonImageStorage();
    (s as unknown as { client: { send: typeof sendMock } }).client.send =
      sendMock;

    await expect(
      s.uploadFromUrl('gifticon/A.jpg', 'http://src/img.jpg'),
    ).rejects.toThrow(/not configured/);
  });
});
