# 02. 데이터 모델

스마트콘이 알려준 원본 정보와 우리가 결정한 노출 정책을 **별도 테이블로 분리**한다.

| 테이블 | 책임 | 누가 쓰나 |
|---|---|---|
| `smartcon_goods` | 스마트콘 응답 박제 | 동기화 잡만 INSERT/UPDATE |
| `gifticon_products` | 우리 노출 상품 (큐레이션 결과) | 어드민 API만 INSERT/UPDATE |

## 1) `smartcon_goods` — 스마트콘 원본 박제

`GetEventGoods.sc` 응답을 그대로 저장한다. 어드민·유저 화면은 이 테이블을 직접 보지 않는다.

> **⚠️ 실제 응답이 V1.9 문서와 다름** — prd 환경에서 직접 호출 검증 결과, 문서엔 없는 필드가 다수 포함되고 일부 문서 필드는 응답에 안 옴. 아래 컬럼은 **실제 응답 기준**.

```sql
CREATE TABLE smartcon_goods (
  goods_id          text PRIMARY KEY,        -- GOODS_ID
  event_id          text NOT NULL,           -- 동기화 시 사용한 EVENT_ID
  brand_name        text,                    -- BRAND_NAME
  goods_name        text,                    -- GOODS_NAME
  msg               text,                    -- MSG (사용 안내, 매우 길 수 있음)

  -- 가격 정보
  price             int,                     -- PRICE (정가)
  disc_price        int,                     -- DISC_PRICE (할인가)
  disc_rate         int,                     -- DISC_RATE (할인율 %)
  extra_charge      int,                     -- EXTRA_CHARGE (추가 요금, 예: ICE 변경 1000원)

  -- 이미지
  img_url           text,                    -- IMG_URL (HTTP — 모바일 노출용 X)
  img_url_https     text,                    -- IMG_URL_HTTPS (실제 노출용)

  -- 분류/정책
  goods_sale_type   text,                    -- GOODS_SALE_TYPE ("BARCODE" 등)
  goods_use_type    text,                    -- GOODS_USE_TYPE ("EXCHANGE" 등)
  sc_limit_date     int,                     -- SC_LIMIT_DATE (유효기간 일수, 예: 30)
  b2c_item_no       text,                    -- B2C_ITEM_NO (현재 null인 경우 다수)

  -- 보존
  raw_data          jsonb,                   -- 응답 원본 (스키마에 없는 필드까지 보존)

  -- 우리 측 상태
  is_active         boolean NOT NULL DEFAULT true, -- 응답에서 사라지면 false
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

### 컬럼 설명

- `img_url` vs `img_url_https`: `IMG_URL`은 HTTP 주소(`HTTP://183.111.10.70:8000/...`)라 모바일 앱에서 사용 불가. **노출용은 `img_url_https`** (`HTTPS://s.spls.io/...`).
- `extra_charge`: 0이 아닌 상품도 있을 수 있음 (예: 스타벅스 ICE 변경 시 추가요금). UX 노출 정책 검토 필요.
- `sc_limit_date`: 유효기간(일수)으로 추정. 예: `30`이면 발송일로부터 30일. **의미 확인 후 `gifticon_orders.exp_date` 계산에 활용**.
- `goods_sale_type`: 현재 모두 `"BARCODE"`. 다른 값이 들어오는 케이스가 있는지 모름.
- `goods_use_type`: 현재 모두 `"EXCHANGE"`. 마찬가지.
- `b2c_item_no`: 현재 모두 `null`. 스마트콘 측 다른 시스템 연동용으로 추정.
- `raw_data`: 컬럼화 안 된 새 필드(예: 향후 `SAMSUNGPAY_RATE` 부활)도 보존되도록 응답 원본 통째 저장. 마이그레이션 없이 활용 가능.
- `is_active`: 동기화 응답에서 빠진 상품은 `false`로 마킹. 행 삭제 X (기존 주문에서 참조).
- `last_synced_at`: 마지막 동기화 시점. 가격 변동 추적/재시도 정책에 활용.

### 응답에 없어서 컬럼화하지 않은 필드

V1.9 문서에는 있지만 prd 응답에 안 와서 제외:

- `LIMIT_CNT` (수량 제한 — 문서상 옵션)
- `SAMSUNGPAY_RATE` (옵션)

→ 향후 응답에 포함되면 `raw_data`에서 추출해 컬럼 추가.

## 2) `gifticon_products` — 우리 노출 상품

어드민이 큐레이션한 결과만 들어간다. 앱 노출 시 `smartcon_goods`와 JOIN해서 표시할 정보를 가져온다.

```sql
CREATE TABLE gifticon_products (
  id                bigserial PRIMARY KEY,
  smartcon_goods_id text NOT NULL UNIQUE
                       REFERENCES smartcon_goods(goods_id),
  point_price       int NOT NULL,           -- 차감 포인트
  display_order     int,                    -- 진열 순서 (낮을수록 위)
  is_visible        boolean NOT NULL DEFAULT false, -- 노출 ON/OFF
  curated_by        uuid,                   -- 어드민 user_id
  curated_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gifticon_products_visible_order
  ON gifticon_products(is_visible, display_order)
  WHERE is_visible = true;
```

### 컬럼 설명

- `smartcon_goods_id`: `UNIQUE` 제약으로 1:1 관계 강제. 같은 스마트콘 상품을 여러 가격으로 동시 노출하는 시나리오는 현재 없음. 필요해지면 제약 풀고 1:N으로 확장.
- `point_price`: 차감 포인트는 어드민이 직접 입력 (자동 환산 없음). `smartcon_goods.disc_price`와 무관하게 운영 가능.
- `is_visible`: 기본값 `false`. 큐레이션 시 명시적으로 `true`로 켜야 노출됨.

## 분리 효과

- **동기화 잡**과 **큐레이션 작업**이 서로 충돌하지 않음
  - 스마트콘 가격이 바뀌어도 우리 `point_price`는 그대로
  - 어드민이 큐레이션하는 동안 동기화가 돌아도 안전
- 스마트콘 상품이 단종돼도 `gifticon_products` 행은 살아있어 기존 주문 내역 참조 가능

## 앱 노출 쿼리

```sql
SELECT
  p.id,
  g.brand_name,
  g.goods_name,
  g.img_url_https AS img_url,    -- HTTPS만 노출
  g.msg,
  g.extra_charge,                 -- 추가 요금 안내 필요 시
  g.sc_limit_date,                -- 유효기간 안내
  p.point_price,
  p.display_order
FROM gifticon_products p
JOIN smartcon_goods g ON p.smartcon_goods_id = g.goods_id
WHERE g.is_active = true
  AND p.is_visible = true
ORDER BY p.display_order ASC, p.id ASC;
```

## 추가 예정 테이블

다음 단계에서 결정 후 추가:

- `gifticon_orders` — 주문/발송 원장 (TR_ID, 차감 point_action_id, 발송 상태, barcode_num, 교환 상태 등)
- 자세한 컬럼은 [99-open-issues.md](./99-open-issues.md)에서 결정 후 본 문서에 추가.
