# 01. 개요

## 목적

캐시모어 유저가 보유 포인트로 기프티콘을 구매할 수 있게 한다. 쿠폰 발급과 MMS 발송은 ㈜스마트콘의 B2B API를 통한다.

## 외부 연동 정보

- **업체**: ㈜스마트콘
- **인증 방식**: IP 화이트리스트 (별도 API Key 없음 — 등록된 서버 IP에서만 호출 가능)
- **호스트**
  - 테스트: `https://b2b-api-dev.giftsmartcon.com`
  - 운영: `https://b2b-api-prd.giftsmartcon.com`
- **응답 포맷**
  - 쿠폰 관련 API 3종 (`couponCreate`, `couponResend`, `couponState`): **XML / EUC-KR 인코딩**
  - 상품 정보 API (`GetEventGoods`): **JSON**

### 사전 준비 사항

- [x] EVENT_ID 발급받음 (스마트콘 측에서 별도 제공) — `64385`
- [x] **prd** 환경 IP 화이트리스트 등록 완료 (NAT Gateway 고정 아웃바운드 IP)
- [x] `GetEventGoods.sc` prd 응답 검증 완료 — 실제 응답 형식이 V1.9 문서와 다름 (자세한 내용은 [02-data-model.md](./02-data-model.md))
- [ ] **dev** 환경에서 EVENT_ID `64385` 미등록 또는 IP 미등록 — connection timeout 발생. 스마트콘 담당자에게 확인 필요 ([99-open-issues.md](./99-open-issues.md) H 항목)
- [ ] 로컬 개발 PC IP 화이트리스트 등록 (선택 사항 — 안 하면 ECS Exec으로만 호출 가능)

## 유저 플로우 (큰 그림)

```
[1] 기프티콘 목록 화면 진입
      └ 어드민이 노출 ON 한 상품을 진열 순서대로

[2] 상품 카드 탭 → 상세 화면
      └ 이미지 / 사용 안내 / 유효기간 / 차감 포인트

[3] [구매하기] 탭
      ├ 포인트 부족 시 → 부족 안내 + 충전/적립 유도 (종료)
      └ 충분하면 다음 단계

[4] 수신번호 입력
      └ 정책 미정 (등록/인증 여부, 본인 강제 여부 등) — 99-open-issues.md

[5] 최종 확인
      └ 상품명 / 차감 포인트 / 받을 번호 + "취소·환불 불가" 안내 동의

[6] 처리 중 (백엔드 처리)
      └ 포인트 차감 + 스마트콘 발송

[7] 결과 화면
      ├ 성공: MMS 발송 안내, 바코드/유효기간 표시
      └ 실패: 자동 환불 안내, 사유 표시

[8] 마이페이지 > 내 기프티콘
      └ 주문 내역 (상품 / 수신번호 마스킹 / 발송일 / 상태)
      └ [재전송] (정책에 따라)
```

## 어드민 흐름 (큰 그림)

자세한 내용은 [03-admin-flow.md](./03-admin-flow.md).

```
1. 스마트콘 상품 동기화 실행
   └ GetEventGoods.sc 호출 → smartcon_goods 테이블 UPSERT

2. 어드민 화면에서 노출할 상품 큐레이션
   ├ 차감 포인트 (point_price) 입력
   ├ 노출 ON/OFF 토글
   └ 진열 순서 지정

3. 저장 → 앱 카탈로그에 즉시 반영
```

## 모듈 구조

```
src/
├── smartcon/                 # 외부 API 클라이언트 (provider)
│   ├ HTTP 호출, XML/EUC-KR 디코딩만 담당
│   └ 비즈니스 로직 없음
│
└── gifticon-exchange/        # 비즈니스 레이어
    ├ 카탈로그 / 주문 / 결제 / 상태 관리
    └ smartcon 모듈을 의존성으로 호출
```

### 분리 이유

- 스마트콘 외 다른 업체로 교체/병행 시 인터페이스만 맞추면 됨
- 외부 API 호출과 내부 비즈니스 룰의 책임 분리
- 단위 테스트 시 `IGifticonProvider` 인터페이스 stub으로 대체 가능
