import { Test, TestingModule } from '@nestjs/testing';
import { StorageAppService } from './storage.service';
import { STORAGE_SERVICE } from './interfaces/storage-service.interface';
import { StubStorageService } from './stub-storage.service';

describe('StorageAppService', () => {
  let service: StorageAppService;
  let stubStorage: StubStorageService;

  const userId = 'test-user-id';

  beforeEach(async () => {
    stubStorage = new StubStorageService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageAppService,
        { provide: STORAGE_SERVICE, useValue: stubStorage },
      ],
    }).compile();

    service = module.get<StorageAppService>(StorageAppService);
  });

  afterEach(() => {
    stubStorage.clear();
  });

  describe('generateSignedUploadUrl', () => {
    it('성공적으로 signed URL을 생성한다', async () => {
      const result = await service.generateSignedUploadUrl(userId);

      expect(result.success).toBe(true);
      expect(result.uploadUrl).toBeDefined();
      expect(result.imagePath).toBeDefined();
      expect(result.publicUrl).toBeDefined();
    });

    it('imagePath에 userId가 포함된다', async () => {
      const result = await service.generateSignedUploadUrl(userId);

      expect(result.imagePath).toMatch(new RegExp(`^${userId}/`));
    });

    it('imagePath에 타임스탬프와 랜덤 ID가 포함된다', async () => {
      const result = await service.generateSignedUploadUrl(userId);

      // format: userId/timestamp_randomHex
      const pathParts = result.imagePath.split('/');
      expect(pathParts).toHaveLength(2);
      const [timestamp, randomId] = pathParts[1].split('_');
      expect(timestamp).toBeDefined();
      expect(randomId).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('매번 다른 imagePath를 생성한다', async () => {
      const result1 = await service.generateSignedUploadUrl(userId);
      const result2 = await service.generateSignedUploadUrl(userId);

      expect(result1.imagePath).not.toBe(result2.imagePath);
    });

    it('publicUrl이 올바른 형식이다', async () => {
      const result = await service.generateSignedUploadUrl(userId);

      expect(result.publicUrl).toBe(
        `https://storage.googleapis.com/every-receipt/${result.imagePath}`,
      );
    });

    it('기본 contentType은 image/jpeg이다', async () => {
      const result = await service.generateSignedUploadUrl(userId);

      expect(result.uploadUrl).toContain('contentType=image/jpeg');
    });

    it('커스텀 contentType을 사용할 수 있다', async () => {
      const result = await service.generateSignedUploadUrl(userId, 'image/png');

      expect(result.uploadUrl).toContain('contentType=image/png');
    });

    it('스토리지 서비스 오류 시 예외가 전파된다', async () => {
      stubStorage.setFailure(true);

      await expect(service.generateSignedUploadUrl(userId)).rejects.toThrow(
        'Storage service failure',
      );
    });

    it('stubStorage에 마지막 생성된 경로가 저장된다', async () => {
      const result = await service.generateSignedUploadUrl(userId);

      expect(stubStorage.getLastGeneratedPath()).toBe(result.imagePath);
    });
  });
});
