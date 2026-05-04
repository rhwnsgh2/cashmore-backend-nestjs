export interface IGifticonImageStorage {
  /**
   * 외부 URL의 이미지를 받아 우리 버킷에 업로드한 뒤 공개 URL을 반환한다.
   *
   * @param path  버킷 내 저장 경로 (예: "gifticon/0000128425.jpg")
   * @param sourceUrl  다운로드할 원본 URL (스마트콘 IMG_URL_HTTPS 등)
   * @returns CloudFront 공개 URL
   */
  uploadFromUrl(path: string, sourceUrl: string): Promise<string>;
}

export const GIFTICON_IMAGE_STORAGE = Symbol('GIFTICON_IMAGE_STORAGE');
