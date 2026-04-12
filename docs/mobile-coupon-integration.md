# 모바일 상품권 교환 연동 설계 문서

## 개요

캐시모어 사용자가 보유한 캐시모어 포인트로 모바일 상품권(기프티콘)을 교환할 수 있는 기능.

- **연동 구조**: 캐시모어 서버 → 다우기술 (B2C 모바일쿠폰 API V3.3)
- **교환 방식**: 사용자가 직접 교환 요청 → 관리자 승인 후 다우기술 발행
- **상품 식별**: `NO_REQ` (쿠폰계약번호 = 상품코드, 다우기술이 사전에 발급)
- **수신 방식**: 온라인 쿠폰 발행 (`CI112_ONLY_ISSUECPN_WITHPAY`) — MMS 발송 없이 쿠폰번호만 발급, 캐시모어 앱에서 표시
- **사용 범위 (1차)**: 온라인 쿠폰 발행 + 발행내역 조회 + 상품정보 다운로드 + 발송결과 포스트백 수신
- **포함하지 않음 (1차)**: MMS 발송, 쿠폰 재발송, 발행 취소(폐기)
- **포스트백 URL (다우기술 등록 완료)**: `POST {캐시모어 도메인}/daou/coupon/postback` — 발송결과/교환내역 통보 수신

> 📎 본 문서의 다우기술 API 스펙은 모두 「모바일쿠폰 B2C 서비스 API 연동규격서 V3.3」 기준.

---

## 1. 상품 카탈로그

다우기술과 계약된 모바일 상품권 목록을 캐시모어 앱에 노출한다.

### 1.1 전체 흐름

```
[동기화 - 배치]
  스케줄러: 다우기술 → POST CC01_DOWN_ALL_GOODSINFO 호출
  서버: 응답 GOODS_LIST를 mobile_coupon_goods 테이블에 upsert
       (no_req 기준, 응답에 없는 상품은 status=inactive 처리)

[조회 - 사용자]
  앱 → 서버: GET /mobile-coupon/goods?category=커피
  서버 → 앱: { goods: [{ noReq, name, brand, price, image, category, ... }] }

[가격 검증 - 교환 요청 시]
  앱 → 서버: POST /mobile-coupon/exchange { noReq }
  서버: mobile_coupon_goods에서 가격 조회 (캐시 신뢰)
       — 단가 변동 우려가 큰 시점에는 CC02_DOWN_SINGLE_GOODSINFO로 재검증
```

### 1.2 캐시모어 API

#### `GET /mobile-coupon/goods` — 상품 목록 조회

| | |
|---|---|
| **용도** | 모바일 상품권 교환 화면 진입 시 호출. 카테고리/브랜드 필터링 지원 |
| **쿼리** | `category` (선택), `brand` (선택), `cursor` (선택, 페이지네이션) |

```json
{
  "goods": [
    {
      "noReq": "123457",
      "name": "오리온) 초코파이",
      "brand": "GS25",
      "category": "편의점",
      "price": 300,
      "imageUrl": "https://...",
      "validityType": "년/월/일 (발행일 + 59D)"
    }
  ]
}
```

#### `GET /mobile-coupon/goods/:noReq` — 단일 상품 조회

| | |
|---|---|
| **용도** | 상품 상세 화면 진입 시 호출 |
| **내부 동작** | mobile_coupon_goods에서 단건 조회. (선택적으로 다우 CC02 호출하여 최신 가격 동기화 후 반환) |

### 1.3 다우기술 상품 조회 API (내부 호출)

#### `CC01_DOWN_ALL_GOODSINFO` — 전체 상품정보 다운로드

- **엔드포인트**: `GET/POST b2ccoupon/b2cService.aspx?ACTION=CC01_DOWN_ALL_GOODSINFO`
- **요청 파라미터**:

| 파라미터 | 필수 | 설명 |
|--------|------|------|
| COOPER_ID | O | 제휴사 식별자 |
| COOPER_PW | O | 제휴사 패스워드 |
| SITE_ID | O | 제휴사(쿠폰발행처) 식별코드 |

- **응답 (XML)**: `<GOODS_LIST>` 안에 `<GOODS_INFO>` 다수

| 필드 | 설명 |
|------|------|
| NO_REQ | 쿠폰계약번호 (상품코드, 캐시모어 PK로 사용) |
| NM_REQ | 쿠폰계약 명 |
| NO_GOODS | 상품번호 (다우기술 관리) |
| NM_GOODS | 상품명 |
| NM_GOODS_COMPANY | 상품제휴처 명 (브랜드) |
| GOODS_PRICE | 상품 정가 |
| CPN_PRICE | 쿠폰 금액 = (정가 − 할인금액) × 수량 |
| GOODS_IMAGE | 상품 이미지 URL |
| CATEGORY | 상품 카테고리 |
| REG_DATE | 최초 등록일 (YYYYMMDD) |
| VALID_START / VALID_END | 의미 없는 임의 값 — 사용 금지 |
| YN_CHANGED / CHANGED_DATE | 항상 N — 상품 변경 여부 추적 불가, 매번 비교 필요 |
| GOODS_COMPANY_CHARGE / DISCOUNT_PRICE / GOODS_DISCOUNT | 사용 안 함 (임의 값 리턴) |

> 📎 참고: 연동 규격서 p.25-27 「전체 상품정보 다운로드」
> ⚠️ 응답 필드 중 다수가 "사용하지 않음 / 임의 값" — 위 표의 사용 가능 필드만 신뢰할 것.

#### `CC02_DOWN_SINGLE_GOODSINFO` — 단일 상품정보 다운로드

- **엔드포인트**: `GET/POST b2ccoupon/b2cService.aspx?ACTION=CC02_DOWN_SINGLE_GOODSINFO`
- **요청 파라미터**: `COOPER_ID`, `COOPER_PW`, `SITE_ID`, `NO_REQ`
- **응답**: `CC01`과 동일 구조 (단일 GOODS_INFO)
- **용도**: 교환 요청 직전 최신 가격 검증, 단일 상품 상세 갱신

> 📎 참고: 연동 규격서 p.28-29 「단일 상품정보 다운로드」

### 1.4 저장 데이터

테이블: `mobile_coupon_goods`

| 컬럼 | 설명 |
|------|------|
| no_req | PK — 다우 쿠폰계약번호 |
| nm_req | 쿠폰계약 명 (내부 식별용) |
| no_goods | 다우 상품번호 |
| nm_goods | 상품명 (앱 표시) |
| brand | 상품제휴처 명 (`NM_GOODS_COMPANY`) |
| category | 카테고리 (`CATEGORY`) |
| price | 캐시모어 표시 가격 = `CPN_PRICE` |
| original_price | 정가 = `GOODS_PRICE` |
| image_url | `GOODS_IMAGE` |
| status | `active` / `inactive` (배치에서 응답에 없으면 inactive) |
| reg_date | 최초 등록일 |
| synced_at | 마지막 동기화 시각 |

### 1.5 동기화 정책

- **주기**: 1일 1회 (cron, 야간 시간대)
- **upsert 기준**: `no_req`
- **inactive 처리**: 직전 응답에 있었으나 이번 응답에 없는 `no_req`는 `status=inactive`
  - 활성 상품 조회: `WHERE status = 'active'`
- **유효기간 정보**: 다우 응답의 `VALID_START/END`는 무의미. 실제 유효기간은 발행 시점에 다우 측에서 산정되며, 캐시모어는 발행 응답의 `GOODS_VALID_START/END`로 확정한다.

---

## 2. 모바일 상품권 교환 요청

사용자가 요청하면 캐시모어 포인트를 즉시 차감하고, 관리자 승인 후 다우기술 API를 통해 모바일 상품권을 발행한다.

### 2.1 전체 흐름

#### 유저 교환 요청 (`POST /mobile-coupon/exchange`)

```
1. 앱 → 서버: POST /mobile-coupon/exchange { noReq: "123457" }
2. 서버: 검증
   - 상품 활성 여부 (mobile_coupon_goods.status = active)
   - 일일 요청 제한 확인
   - 보유 캐시모어 포인트 잔액 확인 (price 이상)
3. 서버: COOPER_ORDER 생성 (캐시모어 측 유일값)
4. 서버: mobile_coupon_exchanges insert (status: pending, no_cpn: null)
5. 서버: PointService.deductPoint(userId, price, 'EXCHANGE_POINT_TO_COUPON', { exchange_id })
   - 실패 시 → 4에서 생성한 exchange row 삭제 후 에러 반환
6. 서버: exchange.point_action_id 저장
7. 서버 → 앱: { exchangeId, noReq, point: 300, status: "pending" }
```

- 유저의 캐시모어 포인트는 **요청 시점에 즉시 차감**된다.
- 이 시점에서 다우기술 API는 호출하지 않는다.

#### 유저 전환 취소 (`DELETE /mobile-coupon/exchange/:id`)

```
1. 앱 → 서버: DELETE /mobile-coupon/exchange/:id
2. 서버: 본인 요청인지, status가 pending인지 확인
3. 서버: PointService.restorePoint(userId, price, 'EXCHANGE_POINT_TO_COUPON', point_action_id, { exchange_id })
4. 서버: exchange.status → cancelled, processed_at 기록
5. 서버 → 앱: { success: true }
```

#### 관리자 승인

```
1. 관리자 → 서버: 승인 처리
2. 서버: exchange.status → approved
3. 서버 → 다우기술: POST CI112_ONLY_ISSUECPN_WITHPAY { COOPER_ORDER, NO_REQ, CALL_CTN, RCV_CTN, VALID_START, VALID_END, ... }
4-a. 성공:
     - 응답 NO_CPN, TS_ID, GOODS_VALID_START, GOODS_VALID_END 저장
     - status → completed, processed_at 기록
4-b. 실패:
     - PointService.restorePoint(...) 포인트 복원
     - status → failed, error_code(RT) 저장
```

#### 관리자 거절

```
1. 관리자 → 서버: 거절 처리
2. 서버: PointService.restorePoint(...)
3. 서버: exchange.status → rejected, processed_at 기록
```

### 2.2 상태 흐름

```
pending → approved → completed (다우 API 성공, NO_CPN 발급 완료)
                   → failed    (다우 API 실패 → 포인트 복원)
        → cancelled (유저 본인 취소 → 포인트 복원)
        → rejected  (관리자 거절 → 포인트 복원)
```

- **포인트 복원이 발생하는 경우**: cancelled, rejected, failed
- **포인트 복원이 발생하지 않는 경우**: completed (정상 발행 완료)

### 2.3 캐시모어 API

#### `POST /mobile-coupon/exchange` — 교환 요청

| | |
|---|---|
| **요청** | `{ "noReq": "123457" }` |
| **내부 동작** | 검증 → exchange row 생성 (pending) → 포인트 차감. 차감 실패 시 exchange row 삭제 |

**검증 항목:**

| 검증 | 실패 시 |
|------|--------|
| 상품 활성 여부 | "현재 교환할 수 없는 상품입니다" |
| 일일 요청 제한 | "오늘 교환 가능한 횟수를 초과했습니다" |
| 보유 포인트 잔액 | "포인트가 부족합니다" |

```json
// 성공
{ "success": true, "data": { "exchangeId": "uuid", "noReq": "123457", "point": 300, "status": "pending" } }
```

#### `DELETE /mobile-coupon/exchange/:id` — 교환 요청 취소

| | |
|---|---|
| **전제 조건** | 본인 요청이고 status가 `pending`인 경우만 |
| **동작** | 포인트 복원 + status → `cancelled` (트랜잭션) |

```json
{ "success": true }
```

#### `GET /mobile-coupon/exchanges` — 교환 내역 조회

| | |
|---|---|
| **용도** | 유저의 교환 요청 목록 표시 |

```json
{
  "exchanges": [
    {
      "id": "uuid",
      "noReq": "123457",
      "name": "오리온) 초코파이",
      "brand": "GS25",
      "imageUrl": "https://...",
      "point": 300,
      "status": "completed",
      "noCpn": "997211405265",
      "validStart": "20260407",
      "validEnd": "20260605",
      "createdAt": "2026-04-07T12:00:00Z",
      "processedAt": "2026-04-07T14:00:00Z"
    }
  ]
}
```

#### `GET /mobile-coupon/exchanges/:id` — 교환 상세 조회

| | |
|---|---|
| **용도** | 발행 완료된 쿠폰의 NO_CPN 표시 (사용자가 매장에서 제시) |
| **내부 동작** | 캐시된 정보 반환. 옵션: status가 completed이고 일정 시간 경과 시 다우 CI06으로 사용 여부 동기화 |

#### `GET /mobile-coupon/config` — 교환 정책 조회

| | |
|---|---|
| **용도** | 교환 화면 진입 시 호출. 정책 및 오늘 사용 현황 표시 |

```json
{
  "dailyLimit": 3,
  "todayUsed": 1
}
```

### 2.4 교환 정책

코드 상수로 관리 (`mobile-coupon.service.ts`의 `EXCHANGE_CONFIG`). 변경 필요 시 코드 수정 후 배포.

| 설정 | 값 | 설명 |
|------|-----|------|
| 환산 비율 | **미정 (TBD)** | 상품권 가격(원) ↔ 차감 포인트 비율. 사업 정책 확정 후 결정 |
| 일일 요청 제한 | 3회 | 하루 3건까지 요청 가능 |

> ⚠️ **환산 비율 미정**: 1:1로 갈지, 수수료/마진을 반영한 비율로 갈지 미정. 차감 포인트 = `상품 CPN_PRICE × 환산비율` 형태로 계산할 예정. 정책 확정 시 본 섹션 및 `EXCHANGE_CONFIG` 갱신 필요.

### 2.5 다우기술 온라인 쿠폰발행 API (내부 호출)

관리자 승인 시 서버에서 호출하는 다우기술 API.

- **엔드포인트**: `GET/POST b2ccoupon/b2cService.aspx?ACTION=CI112_ONLY_ISSUECPN_WITHPAY`
- **요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| COOPER_ID | String | O | 제휴사 식별자 (env) |
| COOPER_PW | String | O | 제휴사 패스워드 (env) |
| SITE_ID | String | O | 제휴사(쿠폰발행처) 식별코드 (env) |
| NO_REQ | String | O | 쿠폰계약번호 (= 상품코드) |
| COOPER_ORDER | String | O | 제휴사 주문번호 (50byte 이내, 유일값 필수) |
| ISSUE_COUNT | Number | O | 발행 요청 쿠폰 수: **1 (고정)** |
| CALL_CTN | String | O | 발신번호 (캐시모어 대표번호, `-`/공백 제외) |
| SENDER | String | X | 발신자명 (사용 안 함, empty 전달) |
| RCV_CTN | String | O | 수신번호 (`-`/공백 제외). 온라인 발행이지만 필수 — 캐시모어 사용자 휴대폰 번호 전달 |
| RECEIVER | String | X | 수신자명 (사용 안 함) |
| SEND_MSG | String | X | 발송 메시지 (사용 안 함, empty 전달) |
| VALID_START | String | O | 쿠폰 유효기간 시작일 (YYYYMMDD) — 발행일자 |
| VALID_END | String | O | 쿠폰 유효기간 종료일 (YYYYMMDD) — 임의 값(다우가 NO_REQ 기준으로 재산정) |
| PAY_ID | String | O | **사용 안 함**, 임의 값 전달 (e.g. `"0"`) |
| BOOKING_NO | String | O | **사용 안 함**, 임의 값 전달 |
| SITE_URL | String | O | **사용 안 함**, 임의 값 전달 |

> ⚠️ `ISSUE_COUNT`는 반드시 1.
> ⚠️ `RCV_CTN`은 MMS 발송이 없더라도 필수 파라미터 — 사용자 본인 휴대폰 번호를 사용한다.
> ⚠️ `VALID_END`는 임의 값을 보내도 다우기술이 NO_REQ에 설정된 유효기간 타입에 따라 재산정한다. 실제 유효기간은 응답의 `GOODS_VALID_END`로 확인.

- **응답 (XML)**: `<CPN_LIST>` 안에 `<CPN>` 1건

| 필드 | 설명 |
|------|------|
| ACTION | `CI112_ONLY_ISSUECPN_WITHPAY` |
| ENGINE_ID | 다우기술 처리 서버 ID |
| RT | 7자리 결과코드 (S000001 = 성공) |
| RTMSG | 결과 메시지 |
| COOPER_ORDER | 요청 시 전달한 제휴사 주문번호 (검증용) |
| ISSUE_COUNT | 발행 쿠폰 수: 1 |
| NO_CPN | **발행 쿠폰번호 (최대 20자리)** — 사용자에게 노출 |
| NO_AUTH | 발행 쿠폰 인증번호 (현재 사용 안 함, `0` 리턴) |
| CPN_PW | 발행 쿠폰 인증 비밀번호 (현재 사용 안 함, `0` 리턴) |
| TS_ID | 발행 쿠폰 트랜잭션 ID (발행 쿠폰 검증용) |
| GOODS_VALID_START | 발행 쿠폰 유효기간 시작일 (YYYYMMDD) |
| GOODS_VALID_END | 발행 쿠폰 유효기간 종료일 (YYYYMMDD) |
| PAY_ID / BOOKING_NO | 요청 시 전달한 임의 값이 그대로 리턴 (사용 안 함) |

> 📎 참고: 연동 규격서 p.13-14 「온라인 쿠폰발행 (CI112_ONLY_ISSUECPN_WITHPAY)」

#### `COOPER_ORDER` 생성 규칙

- **형식**: `yyMMddHHmmss` (Asia/Seoul) + 무작위 식별자 (e.g. uuid 앞 8자)
- **제약**: 50byte 이내, 영문/숫자, 다우기술 측에서 영구 고유값
- 기존 거래 번호와 중복 시 `E000025` (해당 주문번호로 발행한 내역이 있음) 발생 → 새 값으로 재시도
- `mobile_coupon_exchanges.cooper_order`에 저장 → 발행 검증/재조회 시 키로 사용

### 2.6 예외 케이스 (발행 API 실패)

관리자 승인 후 다우기술 API 호출 실패 시 → 포인트 복원 + status → `failed`

| 결과코드 | 원인 | 비고 |
|---------|------|------|
| `E000001` | 접근제어 — ID/비밀번호 불일치 | 운영 이슈, 알림 후 수동 확인 |
| `E000010` | 쿠폰 발행 한도 초과 | 다우 측 한도 — 어드민 확인 필요 |
| `E000016` | 쿠폰 발행 정보 없음 (계약 만료/이미지 없음 등) | 상품 자동 inactive 처리 |
| `E000017` | 발행처 불일치 | SITE_ID 설정 오류 |
| `E000018` | 결제금액과 쿠폰 발행 요청금액 불일치 | 가격 동기화 누락 |
| `E000019` | 쿠폰 발행 도중 오류 | 망 단절 가능성 — `CI07113`로 재조회 후 판단 |
| `E000022` | 사용할 수 없는 쿠폰 | 상품 inactive |
| `E000024` | 발행개수 초과 | ISSUE_COUNT 검증 |
| `E000025` | 해당 주문번호로 발행한 내역 있음 | COOPER_ORDER 중복 — 새 값으로 재발행 시도 |
| `E000029` | 유효기간 만료 (발행일이 종료일보다 과거) | 상품 inactive |
| `E000300` | 외부 연동 오류 (발행) — `EXTERNAL_ISSUE_FAIL` | 다우↔공급사 연동 오류 |
| `E000401` | 업체 타입 오류 — `NOT_SUPPORT_ISSUE_COMPANYTYPE` | 상품 inactive |

> 📎 참고: 연동 규격서 p.30-31 「응답코드」

### 2.7 저장 데이터

테이블: `mobile_coupon_exchanges`

| 컬럼 | 설명 |
|------|------|
| id | PK |
| user_id | 캐시모어 사용자 ID (FK) |
| no_req | 교환 대상 상품 코드 (FK → mobile_coupon_goods) |
| point_amount | 차감한 캐시모어 포인트 (= 요청 시점의 상품 가격) |
| cooper_order | 다우 제휴사 주문번호 (유일값, 승인 시 동일 값 재사용) |
| status | `pending` / `approved` / `completed` / `cancelled` / `rejected` / `failed` |
| no_cpn | 발행 쿠폰번호 (성공 시) |
| ts_id | 다우 트랜잭션 ID (성공 시) |
| valid_start | 발행 쿠폰 유효기간 시작일 (성공 시) |
| valid_end | 발행 쿠폰 유효기간 종료일 (성공 시) |
| dau_cpn_status | 다우 측 쿠폰 상태 (`00`/`01`/`02`/`03`) — 동기화 시 갱신 |
| dau_synced_at | 마지막 다우 상태 동기화 시각 |
| point_action_id | 차감 포인트 액션 ID (FK → point_actions, 복원 시 참조) |
| error_code | 실패 시 다우 결과코드 (RT) |
| error_message | 실패 시 다우 결과 메시지 (RTMSG) |
| created_at | 요청 시각 |
| processed_at | 승인/거절/취소/완료 처리 시각 |

### 2.8 포인트 차감/복원 처리

`PointService`를 통해 `point_actions` 테이블에 insert. 각 모듈이 직접 `point_actions`에 insert하지 않는다.

#### 차감 (교환 요청 시)

```
PointService.deductPoint(userId, 300, 'EXCHANGE_POINT_TO_COUPON', { exchange_id: "uuid" })
→ point_actions insert: { point_amount: -300, type: 'EXCHANGE_POINT_TO_COUPON', status: 'done', additional_data: { exchange_id } }
→ 반환: { pointActionId: 42 }
→ mobile_coupon_exchanges.point_action_id에 42 저장
```

#### 복원 (취소/거절/실패 시)

```
PointService.restorePoint(userId, 300, 'EXCHANGE_POINT_TO_COUPON', 42, { exchange_id })
→ point_actions insert: { point_amount: +300, type: 'EXCHANGE_POINT_TO_COUPON', status: 'done', additional_data: { exchange_id, original_point_action_id: 42 } }
```

- `EXCHANGE_POINT_TO_COUPON` 타입을 신규 등록 → `POINT_ADD_TYPES`에 포함시켜 done 상태일 때 잔액 계산에 합산
- 차감(-300) + 복원(+300) = 0으로 정상 복원

---

## 3. 발행 내역 조회 (검증/동기화)

발행된 쿠폰의 상태(미사용/사용완료/사용중/폐기)를 다우기술에서 재확인하는 API.

### 3.1 사용 시점

- **발행 직후 검증**: 다우 API 응답이 모호할 때 (`E000019` 등) `CI07113_QUERY_COOPERORDER_WITHPAY`로 재조회 후 status 결정
- **사용자 상세 진입 시**: `mobile_coupon_exchanges`의 `dau_synced_at`이 오래되었으면 `CI06_QUERY_NOCPN`으로 사용 여부 동기화
- **배치**: 미사용 쿠폰 만료 임박 알림 (선택)

### 3.2 다우기술 발행내역 조회 API

#### `CI06_QUERY_NOCPN` — NO_CPN 기준 조회

- **엔드포인트**: `GET/POST b2ccoupon/b2cService.aspx?ACTION=CI06_QUERY_NOCPN`
- **요청 파라미터**:

| 파라미터 | 필수 | 설명 |
|--------|------|------|
| COOPER_ID | O | 제휴사 식별자 |
| COOPER_PW | O | 제휴사 패스워드 |
| SITE_ID | O | 제휴사 식별코드 |
| NO_CPN | O | 기 발행된 쿠폰번호 |

> 📎 참고: 연동 규격서 p.21-22 「쿠폰발행내역조회 BY NO_CPN」

#### `CI07113_QUERY_COOPERORDER_WITHPAY` — COOPER_ORDER 기준 조회

- **엔드포인트**: `GET/POST b2ccoupon/b2cService.aspx?ACTION=CI07113_QUERY_COOPERORDER_WITHPAY`
- **요청 파라미터**:

| 파라미터 | 필수 | 설명 |
|--------|------|------|
| COOPER_ID | O | 제휴사 식별자 |
| COOPER_PW | O | 제휴사 패스워드 |
| SITE_ID | O | 제휴사 식별코드 |
| COOPER_ORDER | O | 제휴사 주문번호 |

> 📎 참고: 연동 규격서 p.23-24 「쿠폰발행내역조회 BY COOPER_ORDER」
> 💡 발행 직후 검증에 권장 — `NO_CPN`이 아직 캐시모어 DB에 없는 상황에서도 사용 가능

#### 두 API 공통 응답 (XML)

| 필드 | 설명 |
|------|------|
| RT | 결과코드 |
| RTMSG | 결과 메시지 |
| LIST_COUNT | 조회된 쿠폰 내역 수 |
| CPN_LIST > CPN_INFO | 쿠폰 상세 (다수 가능) |
| └ COOPER_ORDER | 제휴사 주문번호 |
| └ NO_CPN | 쿠폰번호 |
| └ ISSUE_DATE | 쿠폰 발행일 |
| └ **CPN_STATUS** | 쿠폰 상태 (아래 표) |
| └ CPN_START | 유효기간 시작일 |
| └ CPN_END | 유효기간 종료일 |
| └ NO_REQ | 쿠폰계약번호 |
| └ NM_GOODS | 쿠폰상품명 |
| └ CPN_PRICE | 쿠폰 상품 금액 |
| └ CALL_CTN / RCV_CTN | 발신/수신번호 |
| └ USE_COMPANY | 교환 가능 브랜드명 |
| └ USE_STORE | 쿠폰 교환 지점명 (사용 시에만 값) |
| └ USE_DATE | 쿠폰 교환일 (사용 시에만 값) |
| └ PAY_MONEY | 사용 안 함 (임의 값) |

#### `CPN_STATUS` 값

| 코드 | 설명 | 캐시모어 매핑 |
|------|------|--------------|
| `00` | 쿠폰발행 (교환대기, 미사용) | 정상 — 사용 가능 |
| `01` | 쿠폰사용 (교환완료, 사용) | 사용 완료 표시 |
| `02` | 쿠폰폐기 (쿠폰발행취소상태) | 어드민 폐기/문제 발생 — 알림 |
| `03` | 쿠폰사용중 (교환상태, 사용중) | 사용 중 표시 |

> ⚠️ `LIST_COUNT`와 `<CPN_INFO>` 개수가 다르면 응답 무효 — 폐기 처리해야 함.
> ⚠️ `CPN_STATUS`가 `01`/`03`이 아닌 경우 `USE_STORE`/`USE_DATE`는 NULL.

---

## 4. 발송결과 포스트백 (다우기술 → 캐시모어)

다우기술이 쿠폰 발송 결과 및 교환(사용) 내역을 캐시모어 서버로 비동기 통보하는 콜백.
**다우기술 측에 등록된 콜백 URL: `POST {캐시모어 도메인}/daou/coupon/postback`**

> 📎 본 기능은 연동 규격서 V3.3 본문에는 별도 명세가 없으나, 개정이력 1.6 (2012-04-17)의 "쿠폰 발송결과 전달, 쿠폰 교환내역 전달"에 해당. 실제 페이로드 스펙은 다우기술과 별도 협의 필요.

### 4.1 콜백 종류

다우기술이 두 가지 시점에 캐시모어 서버로 POST 요청을 보낸다.

| 종류 | 발생 시점 | 캐시모어 처리 |
|------|----------|--------------|
| **발송 결과** | 다우 측에서 쿠폰 발행/MMS 발송 처리가 끝난 시점 | exchange status를 다우 결과에 맞춰 갱신 (보조 검증 — 동기 응답이 우선) |
| **교환 내역** | 사용자가 매장에서 쿠폰을 실제 사용(교환)했을 때 | `dau_cpn_status` → `01`(사용) 또는 `03`(사용중) 갱신, 사용자 알림 발송 |

### 4.2 캐시모어 엔드포인트

#### `POST /daou/coupon/postback`

| | |
|---|---|
| **인증** | 다우기술 → 캐시모어 단방향 호출 — 서명/IP 화이트리스트로 검증 |
| **요청 형식** | (다우 협의 필요) — XML 또는 form-urlencoded 추정 |
| **응답** | HTTP 200 OK + 단순 성공 응답 (다우 측 재시도 방지) |
| **멱등성** | 동일 콜백이 중복 수신될 수 있음 — `(no_cpn, callback_type, event_at)` 기준 멱등 처리 필수 |

**예상 페이로드 (다우 협의 후 확정):**

| 필드 | 설명 |
|------|------|
| ACTION 또는 TYPE | 콜백 종류 (발송결과 / 교환내역) |
| COOPER_ORDER | 제휴사 주문번호 — 캐시모어 exchange row 매칭 키 |
| NO_CPN | 발행 쿠폰번호 |
| CPN_STATUS | 쿠폰 상태 (`00`/`01`/`02`/`03`) |
| USE_DATE | 사용일 (교환 콜백) |
| USE_STORE | 사용 지점명 (교환 콜백) |
| USE_COMPANY | 사용 브랜드명 (교환 콜백) |
| RT / RTMSG | 결과코드 / 메시지 (발송결과 콜백) |

### 4.3 처리 흐름

```
[발송결과 콜백]
  다우 → 서버: POST /daou/coupon/postback { type: 발송결과, COOPER_ORDER, NO_CPN, RT, ... }
  서버: COOPER_ORDER로 mobile_coupon_exchanges 조회
  서버: 동기 응답으로 이미 status가 completed라면 → 무시 (멱등)
       아니라면 → status/no_cpn/error_code 갱신
  서버 → 다우: 200 OK

[교환 콜백]
  다우 → 서버: POST /daou/coupon/postback { type: 교환내역, NO_CPN, CPN_STATUS, USE_DATE, USE_STORE, ... }
  서버: NO_CPN으로 mobile_coupon_exchanges 조회
  서버: dau_cpn_status, dau_synced_at 갱신
       → 01(사용)이면 사용 완료 알림 발송 (push/in-app)
  서버 → 다우: 200 OK
```

### 4.4 보조 동기화

콜백은 유실 가능성이 있으므로 **단일 진실 공급원(SoT)으로 신뢰하지 않는다.** 보강:

- 사용자가 교환 내역 상세 진입 시 `dau_synced_at`이 N분 이상 오래되었으면 `CI06_QUERY_NOCPN` 호출하여 최신 상태 동기화
- 배치: 미사용(`00`) 상태가 오랫동안 변경 없는 쿠폰을 주기적으로 재조회

### 4.5 저장 데이터 (선택)

콜백 수신 이력을 별도 테이블에 보관하면 재처리/디버깅에 유리.

테이블: `mobile_coupon_callbacks` (선택)

| 컬럼 | 설명 |
|------|------|
| id | PK |
| exchange_id | FK → mobile_coupon_exchanges (매칭 성공 시) |
| callback_type | `dispatch` (발송결과) / `usage` (교환내역) |
| no_cpn | 콜백의 NO_CPN |
| cooper_order | 콜백의 COOPER_ORDER |
| raw_payload | 원본 페이로드 (JSON 또는 텍스트) |
| received_at | 수신 시각 |
| processed_at | 처리 완료 시각 |
| status | `received` / `processed` / `failed` / `duplicated` |

### 4.6 TODO (다우기술 협의 사항)

- [ ] 콜백 페이로드 정확한 필드 스펙 (Content-Type, 파라미터 이름, 인코딩)
- [ ] 다우기술 발신 IP 목록 (화이트리스트 등록용)
- [ ] 콜백 재시도 정책 (실패 시 몇 회 재시도, 간격)
- [ ] 콜백 인증 방식 (서명, 토큰, IP 제한 등)

---

## 5. 공통 인프라

### 5.1 통신 방식

- **프로토콜**: HTTPS
- **베이스 URL**: `{DAOU_API_BASE_URL}/b2ccoupon/b2cService.aspx`
- **메서드**: GET 또는 POST
- **요청 파라미터 전달**: query string 또는 form-urlencoded
- **응답 형식**: XML (UTF-8) — `<CJSERVICE>` 루트
- **필요 라이브러리**: `fast-xml-parser` (또는 동급) — XML 파싱

### 5.2 인코딩

- 응답 XML: UTF-8
- `SEND_MSG` (사용 안 함이지만 명세상): EUC-KR 기준 500byte 이내
- 본 1차 범위에서는 메시지 발송이 없어 인코딩 변환 불필요

### 5.3 환경 변수

| 변수 | 설명 | 비고 |
|------|------|------|
| DAOU_API_BASE_URL | 다우기술 API 기본 URL | 테스트/상용 분리 |
| DAOU_COOPER_ID | 제휴사 식별자 | 다우기술 발급 |
| DAOU_COOPER_PW | 제휴사 패스워드 | 다우기술 발급 |
| DAOU_SITE_ID | 제휴사(쿠폰발행처) 식별코드 | 다우기술 발급 |
| DAOU_CALL_CTN | 발신번호 (CALL_CTN) | 캐시모어 대표번호 |

### 5.4 연동 절차 (다우기술 가이드)

1. 제휴 계약 후 다우기술이 `COOPER_ID` / `COOPER_PW` / `SITE_ID` 발급 (※방화벽 선작업 필수)
2. 제휴사에 연계된 쿠폰계약번호(`NO_REQ`) 할당받기
3. 테스트 서버 정보 요청 → 승인 후 테스트 서버 정보 수신
4. API 규격에 맞게 테스트 수행 → 정상 통신 확인 후 상용 서버 정보 요청 (※상용 서버 IP를 다우기술에 전달, 방화벽 선작업 필수)
5. 상용 검증 테스트 완료 후 최종 연동 종료

> 📎 참고: 연동 규격서 p.9 「연동 절차」

---

## 6. 1차 범위 외 (향후 확장 후보)

본 문서의 1차 범위는 **온라인 발행 + 발행내역 조회 + 상품정보 다운로드**.
아래 기능은 1차 범위에서 제외하되, 스펙은 기록해둔다.

| 기능 | ACTION | 비고 |
|------|--------|------|
| MMS(TITLE 포함) 쿠폰발행 | `CI102_ISSUECPN_TITLE_WITHPAY` | 사용자 휴대폰으로 MMS 직접 발송 |
| MMS 쿠폰발행 | `CI102_ISSUECPN_WITHPAY` | TITLE 없는 MMS 발송 |
| 쿠폰 SMS 재발송 | `CI103_RETRY_TOSENDCPN` | 최대 5회 |
| 쿠폰 MMS 재발송 | `CI103_RETRY_TOSENDMMS` | 최대 5회 |
| 쿠폰발행취소 BY NO_CPN | `CI104_DISUSECPN` | 미사용분만 폐기 가능 |
| 쿠폰발행취소 BY COOPER_ORDER | `CI105_DISUSECPN_WITHPAY` | 미사용분만 폐기 가능 |

> 📎 참고: 연동 규격서 p.11-20

---

## 부록: 다우기술 응답코드 전체

> 📎 참고: 연동 규격서 p.30-31
> ⚠️ 응답코드는 추가/변경될 수 있음

### 성공

| 코드 | 설명 |
|------|------|
| S000001 | SUCCESS |

### 일반 오류

| 코드 | 설명 |
|------|------|
| E000001 | 접근제어 — 아이디/비밀번호 확인 필요 |
| E000002 | 필수 입력값 없음 |
| E000003 | 쿠폰 발행 요청 개수와 수신번호 개수 불일치 |
| E000004 | 쿠폰 결제 정보 없음 |
| E000005 | 쿠폰 발행 정보 없음 |
| E000006 | 쿠폰 생성 단계 오류 |
| E000007 | 쿠폰 번호 생성 실패 |
| E000008 | 쿠폰 발행 정보 생성 실패 |
| E000009 | 쿠폰 상품 정보 생성 실패 |
| E000010 | 쿠폰 발행 한도 초과 |
| E000011 | 쿠폰 요청 정보 생성 실패 |
| E000012 | 쿠폰 발송 내역 저장 실패 |
| E000013 | 쿠폰 발행 시간 업데이트 실패 |
| E000014 | 쿠폰 발행 상태 업데이트 실패 |
| E000015 | 입력값 오류 |
| E000016 | 쿠폰 발행 정보 없음 (계약정보, 문구, 이미지, 발송아이디 등) |
| E000017 | 발행처 불일치 |
| E000018 | 결제 금액과 쿠폰 발행 요청 금액 불일치 |
| E000019 | 쿠폰 발행 도중 오류 |
| E000020 | 재발송 횟수는 최대 3번 |
| E000021 | 메시지 80byte 초과 |
| E000022 | 사용할 수 없는 쿠폰 |
| E000023 | 쿠폰 폐기 도중 오류 |
| E000024 | 발행개수 초과 |
| E000025 | 해당 주문번호로 발행 내역 있음 |
| E000026 | 이미 구입하신 쿠폰 |
| E000027 | 구매 이력 조회 중 오류 |
| E000028 | 수신결과값 없음 |
| E000029 | 유효기간 만료일이 발행일보다 과거일자 |
| E000030 | 업체 발행 한도 차감 수정 실패 |

### 외부 연동/세부 오류

| 코드 | 설명 |
|------|------|
| E000300 | 외부 연동 오류 (발행) `EXTERNAL_ISSUE_FAIL` |
| E000301 | 재발송 쿠폰 정보 오류 |
| E000302 | Send Data Exception |
| E000303 | Send Type Exception |
| E000304 | IssueTypeNotExistException |
| E000305 | 폐기 쿠폰 정보 오류 |
| E000401 | 업체 타입 오류 `NOT_SUPPORT_ISSUE_COMPANYTYPE` |
| E005005 | 쿠폰 폐기 오류 `DISUSE_CPN_UPDATE_FAIL` / DISUSE STATUS CHANGE ERROR |
| E005006 | 쿠폰 기간만료 오류 `OVERDUE_USE_PERIOD_ERROR` |
| E005100 | 외부 연동 오류 (폐기) `EXTERNAL_DISUSE_FAIL` |
| E006005 | 쿠폰 연장 오류 `COUPON_VALID_UPDATE_FAIL` |
| E006100 | 외부 연동 오류 (연장) `EXTERNAL_EXTENSION_FAIL` |
| E007007 | 쿠폰 재발송 횟수 초과 `RESEND_OVERCNT_ERROR` |
| E007008 | 쿠폰 재발송 입력값 검증 실패 |
| E900001 | 실패 |
| E999999 | 쿠폰 발행 실패 [INFO] (MESSAGE) |

---

## 주의사항

- **XML 파싱 필수**: 다우 응답은 모두 XML. JSON 응답 없음.
- **유효기간은 발행 시 확정**: 상품 카탈로그의 `VALID_START/END`는 사용 금지. 발행 응답의 `GOODS_VALID_START/END`만 신뢰.
- **COOPER_ORDER 영구 보관**: 다우 측에 영구 저장됨. 재시도 시 새 값 필수.
- **idempotent 아님**: 다우 발행 API가 idempotent하지 않으므로 응답 모호 시 `CI07113`로 재조회 후 status 확정.
- **상품 변경 추적 불가**: `YN_CHANGED`는 항상 N으로 리턴. 동기화 배치에서 매번 전체 비교 필요.
- **테스트/상용 분리**: 최초 연동 시 테스트 → 검증 → 상용 승인 단계 필수. 양쪽 모두 방화벽 선작업 필요.
- **상품 가격은 `CPN_PRICE` 사용**: `GOODS_PRICE`(정가)가 아닌 `CPN_PRICE`(쿠폰 금액)가 실제 결제/차감 단가.
