# 스마트콘 기프티콘 연동

캐시모어 유저가 보유 포인트로 기프티콘을 구매하는 기능. 발급/발송은 ㈜스마트콘 B2B API를 통해 이루어진다.

> 참고: `docs/mobile-coupon-integration.md`는 네이버페이 환전용 다우기술 연동 문서로, 본 기능과 무관하다. 곧 폐기 예정.

## 문서 인덱스

- [01-overview.md](./01-overview.md) — 목적, 외부 연동 정보, 유저 플로우, 모듈 구조
- [02-data-model.md](./02-data-model.md) — DB 테이블 (`smartcon_goods`, `gifticon_products`)
- [03-admin-flow.md](./03-admin-flow.md) — 어드민 카탈로그 큐레이션 흐름
- [99-open-issues.md](./99-open-issues.md) — 미정 / 결정 필요 항목

## 진행 상태

- [x] 큰 그림 유저 플로우
- [x] 카탈로그 데이터 모델 (스마트콘 원본 / 우리 노출 분리)
- [x] 어드민 큐레이션 흐름
- [x] **prd 환경 `GetEventGoods.sc` 응답 검증** (2026-05-04)
- [ ] dev 환경 동작 확인 (현재 timeout — 99-H 참고)
- [ ] 수신번호 등록 / 인증 정책
- [ ] 주문/결제 흐름 (포인트 차감 ↔ 스마트콘 발송 atomicity)
- [ ] 주문 테이블(`gifticon_orders`) 스키마
- [ ] 어드민/유저 API 스펙
- [ ] 운영 정책 (재전송, 상태 폴링, 동기화 주기, 가격 변동 대응)
- [ ] 구현
