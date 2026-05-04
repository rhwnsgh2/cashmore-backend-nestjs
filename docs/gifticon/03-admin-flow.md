# 03. 어드민 카탈로그 큐레이션

## 흐름

```
[1] 어드민이 [스마트콘 상품 동기화] 실행
     └ 백엔드: GetEventGoods.sc 호출 (EVENT_ID 환경변수)
     └ 응답을 smartcon_goods 테이블에 UPSERT
        ├ 신규 GOODS_ID → INSERT (is_active=true)
        ├ 기존 GOODS_ID → UPDATE (필드 갱신, is_active=true 보장)
        └ 응답에서 사라진 GOODS_ID → UPDATE is_active=false

[2] 어드민 화면: 전체 상품 리스트
     └ smartcon_goods LEFT JOIN gifticon_products
     └ 각 행:
        이미지 / 브랜드 / 상품명
        정가 / 할인가 / 한도수량
        노출토글(is_visible) / 진열순서(display_order) / 차감포인트(point_price)

[3] 어드민이 상품별로 큐레이션
     ├ point_price 입력 (필수)
     ├ is_visible 토글
     └ display_order 입력
     ※ gifticon_products에 행이 없으면 INSERT, 있으면 UPDATE

[4] 저장 → 앱 카탈로그에 즉시 반영
```

## 동기화 동작 정의

| 케이스 | `smartcon_goods` | `gifticon_products` |
|---|---|---|
| 신규 상품 | INSERT (`is_active=true`) | **자동 생성 안 함** — 어드민이 명시적으로 큐레이션할 때 INSERT |
| 기존 상품 | UPDATE (이름/가격/이미지 등 갱신) | **건드리지 않음** (어드민의 결정 보존) |
| 응답에서 사라진 상품 | UPDATE `is_active=false` | **건드리지 않음** (기존 주문 내역에서 참조 필요) |

> 핵심 원칙: 동기화 잡은 절대 `gifticon_products`를 수정하지 않는다. 어드민의 결정을 동기화가 덮어쓰면 큐레이션 작업이 무의미해진다.

## 어드민 측이 신경 써야 할 시나리오

### A. 가격이 바뀐 상품

- `smartcon_goods.price` / `disc_price`가 변경됨
- 우리 `gifticon_products.point_price`는 자동으로 안 따라감 → **어드민이 직접 판단해서 갱신**
- 차이가 일정 이상이면 어드민에 알림? — 정책 미정 ([99-open-issues.md](./99-open-issues.md))

### B. 단종된 상품

- `smartcon_goods.is_active=false`로 마킹됨
- 앱 노출 쿼리에서 자동 제외됨 (`g.is_active = true` 조건)
- `gifticon_products` 행 자체는 보존 (기존 주문 내역 참조용)
- 어드민 화면에서는 단종 상태 명확히 표시 필요

### C. 신규 상품

- `smartcon_goods`에만 INSERT 됨, `gifticon_products`는 비어 있음
- 어드민 화면에서 "미큐레이션" 상태로 표시
- 어드민이 가격/순서/노출 결정해야 비로소 앱에 보임

## 미정 항목 (다음 결정 필요)

- 동기화 트리거: 수동 버튼만 / 자동 배치 / 둘 다
- 자동 배치 주기 (있다면)
- 가격 변동 시 알림 정책
- 어드민 권한 범위 (누가 큐레이션 가능?)
- 어드민 API 엔드포인트 스펙

→ [99-open-issues.md](./99-open-issues.md) 참고
