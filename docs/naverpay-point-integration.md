# 네이버페이 포인트 전환 연동 설계 문서

## 개요

캐시모어 사용자가 보유한 캐시모어 포인트를 네이버페이 포인트로 전환할 수 있는 기능.

- **연동 구조**: 캐시모어 서버 → 다우기술 (중계) → 네이버페이
- **전환 방식**: 사용자가 직접 전환 요청 (수동)
- **사용자 식별**: 네이버 아이디 로그인 기반 (uniqueId)

---

## 1. 네이버 계정 연결

사용자가 포인트를 전환하려면 먼저 네이버 계정을 캐시모어에 연결해야 한다.
연결은 **사전에 미리** 진행하며, 전환 시점에 매번 로그인하지 않는다.

### 1.1 전체 흐름

```
[최초 연결]
  앱: 네이버 로그인 SDK → uniqueId 획득
  앱 → 서버: POST /naverpay/connect { uniqueId }
  서버 → 다우기술: POST /v1/npay/members/nid { uniqueId, clientId, clientSecret }
  서버: 응답의 userKey, maskingId를 naver_pay_accounts에 저장
  서버 → 앱: { maskingId, naverPayPoint }
  앱: "nav*** 계정에 연결됨" 표시

[연결 상태 확인]
  앱 → 서버: GET /naverpay/account
  서버 → 앱: { connected, maskingId, connectedAt } 또는 { connected: false }

[계정 변경]
  앱 → 서버: DELETE /naverpay/account → 기존 계정 disconnected 처리
  앱: 네이버 로그인 SDK (다른 계정) → 새 uniqueId 획득
  앱 → 서버: POST /naverpay/connect { uniqueId } → 새 row 생성

[연결 실패 → 재시도]
  앱: 에러 메시지 표시 (네이버페이 미가입, 휴면 등)
  유저: 외부 조치 후 네이버 로그인부터 다시 진행
```

### 1.2 캐시모어 API

#### `GET /naverpay/account` — 연결 상태 조회

| | |
|---|---|
| **용도** | 네이버페이 전환 화면 진입 시 호출. 연결 여부에 따라 UI 분기 |

```json
// 연결됨
{ "connected": true, "maskingId": "nav***", "connectedAt": "2026-03-16T12:00:00Z" }

// 미연결
{ "connected": false }
```

#### `POST /naverpay/connect` — 계정 연결

| | |
|---|---|
| **전제 조건** | 현재 connected 상태인 계정이 없어야 함 (있으면 거부 → 먼저 해제 필요) |
| **요청** | `{ "uniqueId": "네이버 로그인 유니크 아이디" }` |
| **내부 동작** | 다우기술 회원 조회 API 호출 → 결과를 DB에 저장 |
| **남용 방지** | 일일 연결 시도 횟수 제한 (당일 failed row 수로 판단) |

```json
// 성공
{ "success": true, "data": { "maskingId": "nav***", "naverPayPoint": 3500 } }

// 실패
{ "success": false, "errorCode": "52004", "errorMessage": "네이버페이 가입 후 다시 시도해주세요" }
```

**connect 호출 시 상태별 처리:**

| 현재 상태 | 처리 |
|----------|------|
| connected row 있음 | 거부 ("먼저 해제하세요") |
| failed/disconnected row만 있음 | 새 row 생성 |
| row 없음 | 새 row 생성 |

#### `DELETE /naverpay/account` — 계정 연결 해제

| | |
|---|---|
| **동작** | connected row의 status를 `disconnected`로 변경 + 민감 정보 삭제 (row 자체는 보존) |
| **민감 정보 삭제** | `naver_unique_id`, `dau_user_key`, `dau_masking_id`를 null 처리 |
| **연결된 계정 없을 시** | 에러 반환 |
| **pending 전환 요청 있을 시** | 해제 거부 ("진행 중인 전환 요청이 있습니다. 전환 요청을 취소한 후 해제해주세요") |
| **필수 여부** | 네이버 로그인 정책상 연동 해제 기능 제공 필수 |

```json
{ "success": true }
```

### 1.3 다우기술 회원 조회 API (내부 호출)

`POST /naverpay/connect` 내부에서 호출하는 다우기술 API.

- **엔드포인트**: `POST /v1/npay/members/nid`
- **요청 파라미터** (모두 AES 암호화 필수):

| 파라미터 | 설명 |
|--------|------|
| uniqueId | 네이버 아이디 로그인 유니크 아이디 |
| clientId | 네이버 아이디 로그인 Client ID |
| clientSecret | 네이버 아이디 로그인 Client Secret |

- **응답**:

| 파라미터 | 설명 |
|--------|------|
| maskingId | 일부 마스킹된 네이버 아이디 (예: `nav***`) |
| point | 현재 네이버페이 포인트 잔액 |
| userKey | 네이버페이 유니크 아이디 (이후 적립에 사용) |

> 📎 참고: 제휴사 API 연동 규격서 p.3 "네이버페이 회원 정보 조회 (네이버 아이디 로그인 기반)"

### 1.4 저장 데이터

테이블: `naver_pay_accounts`

| 컬럼 | 설명 |
|------|------|
| id | PK |
| user_id | 캐시모어 사용자 ID (FK) |
| naver_unique_id | 네이버 로그인 유니크 아이디 (nullable — 해제 시 삭제됨) |
| dau_user_key | 네이버페이 유니크 아이디 (적립 시 사용, 성공 시. 해제 시 삭제됨) |
| dau_masking_id | 마스킹된 네이버 아이디 (UI 표시용, 성공 시. 해제 시 삭제됨) |
| status | `connected` / `disconnected` / `failed` |
| error_code | 실패 시 에러코드 |
| connected_at | 연결 시각 |
| disconnected_at | 연결 해제 시각 |

- **user_id는 유니크하지 않음** — 계정 변경 시 이전 row(disconnected)는 이력으로 보존, 새 row 생성
- 활성 계정 조회: `WHERE user_id = ? AND status = 'connected'`

### 1.5 예외 케이스

| 에러코드 | 원인 | 유저 안내 |
|---------|------|----------|
| `52004` | 네이버페이 미가입 (이용 약관 미동의) | "네이버페이 가입 후 다시 시도해주세요" |
| `52001` | 네이버페이 계정 휴면 | "네이버페이 계정 상태를 확인해주세요" |
| `52002` | 네이버페이 계정 블랙 | "네이버페이 계정 상태를 확인해주세요" |

> 📎 참고: 제휴사 API 연동 규격서 p.7 에러코드
> 📎 참고: 소개자료 p.13 FAQ - "네이버 ID가 있으시더라도 네이버페이 이용 약관 동의를 해주셔야 네이버페이 포인트 적립과 사용이 가능합니다."
> 📎 참고: 소개자료 p.13 FAQ - "휴면은 로그인 후 휴면 해제 / 블랙은 네이버 고객센터를 통해 해제가 가능합니다."

---

## 2. 포인트 전환 요청

사용자가 요청하면 캐시모어 포인트를 즉시 차감하고, 관리자 승인 후 다우기술 API를 통해 네이버페이 포인트를 적립한다.
전환 비율은 1:1.01로, 캐시모어 1000P → 네이버페이 1010P.

### 2.1 전체 흐름

#### 유저 전환 요청 (`POST /naverpay/exchange`)

```
1. 앱 → 서버: POST /naverpay/exchange { point: 5000 }
2. 서버: 검증
   - 네이버페이 계정 connected 확인
   - 최소 전환 금액 확인 (1,000P 이상)
   - 일일 요청 제한 확인 (1일 1회)
   - 보유 캐시모어 포인트 잔액 확인 (5000P 이상)
3. 서버: 전환 비율 적용 (5000 × 1.01 = 5050 네이버페이 포인트)
4. 서버: naver_pay_exchanges insert (status: pending)
5. 서버: point_actions insert (-5000, type: EXCHANGE_POINT_TO_NAVERPAY, status: done)
   - 실패 시 → 4에서 생성한 exchange row 삭제 후 에러 반환
6. 서버: exchange에 point_action_id 저장
7. 서버 → 앱: { exchangeId, cashmorePoint: 5000, naverpayPoint: 5050, status: "pending" }
```

- 유저의 캐시모어 포인트는 **요청 시점에 즉시 차감**된다.
- 이 시점에서 다우기술 API는 호출하지 않는다.

#### 유저 전환 취소 (`DELETE /naverpay/exchange/:id`)

```
1. 앱 → 서버: DELETE /naverpay/exchange/:id
2. 서버: 본인 요청인지, status가 pending인지 확인
3. 서버: point_actions insert (+5000, type: EXCHANGE_POINT_TO_NAVERPAY) — 포인트 복원
   - original_point_action_id로 원래 차감 건 참조
4. 서버: exchange status → cancelled, processed_at 기록
5. 서버 → 앱: { success: true }
```

#### 관리자 승인

```
1. 관리자 → 서버: 승인 처리
2. 서버: exchange status → approved
3. 서버: partnerTxNo 생성
4. 서버 → 다우기술: POST /v1/npay/point { userKey(암호화), partnerTxNo, point: 5050 }
5-a. 성공: txNo 저장, status → completed
5-b. 실패: point_actions insert (+5000) 포인트 복원, status → failed, error_code 저장
```

#### 관리자 거절

```
1. 관리자 → 서버: 거절 처리
2. 서버: point_actions insert (+5000) — 포인트 복원
3. 서버: exchange status → rejected, processed_at 기록
```

### 2.2 상태 흐름

```
pending → approved → completed (다우 API 성공, 네이버페이 포인트 적립 완료)
                   → failed (다우 API 실패 → 캐시모어 포인트 복원)
        → cancelled (유저 본인 취소 → 캐시모어 포인트 복원)
        → rejected (관리자 거절 → 캐시모어 포인트 복원)
```

- **포인트 복원이 발생하는 경우**: cancelled, rejected, failed
- **포인트 복원이 발생하지 않는 경우**: completed (정상 전환 완료)

### 2.3 캐시모어 API

#### `POST /naverpay/exchange` — 전환 요청

| | |
|---|---|
| **전제 조건** | 네이버페이 계정 connected 상태 |
| **요청** | `{ "point": 5000 }` |
| **내부 동작** | 검증 → exchange row 생성 (pending) → 포인트 차감. 차감 실패 시 exchange row 삭제 |

**검증 항목:**

| 검증 | 실패 시 |
|------|--------|
| 네이버페이 계정 연결 확인 | "네이버페이 계정을 먼저 연결해주세요" |
| 최소 전환 금액 (1,000P) | "최소 1,000P부터 전환 가능합니다" |
| 일일 요청 제한 (1회) | "오늘 이미 전환 요청을 하셨습니다" |
| 보유 포인트 잔액 | "포인트가 부족합니다" |

```json
// 성공
{ "success": true, "data": { "exchangeId": "uuid", "cashmorePoint": 5000, "naverpayPoint": 5050, "status": "pending" } }
```

#### `DELETE /naverpay/exchange/:id` — 전환 요청 취소

| | |
|---|---|
| **전제 조건** | 본인 요청이고 status가 `pending`인 경우만 |
| **동작** | 포인트 복원 + status → `cancelled` (트랜잭션) |

```json
{ "success": true }
```

#### `GET /naverpay/exchanges` — 전환 내역 조회

| | |
|---|---|
| **용도** | 유저의 전환 요청 목록 표시 |

```json
{
  "exchanges": [
    {
      "id": "uuid",
      "cashmorePoint": 5000,
      "naverpayPoint": 5000,
      "status": "completed",
      "createdAt": "2026-03-16T12:00:00Z",
      "processedAt": "2026-03-16T14:00:00Z"
    }
  ]
}
```

#### `GET /naverpay/config` — 전환 정책 조회

| | |
|---|---|
| **용도** | 전환 화면 진입 시 호출. 현재 전환 정책 및 오늘 사용 현황 표시 |

```json
{
  "exchangeRate": 1,
  "minPoint": 1000,
  "dailyLimit": 1,
  "todayUsed": 0
}
```

### 2.4 전환 정책

코드 상수로 관리 (`naver-pay.service.ts`의 `EXCHANGE_CONFIG`). 변경 필요 시 코드 수정 후 배포.

| 설정 | 값 | 설명 |
|------|-----|------|
| 전환 비율 | 1.01 | 캐시모어 1000P → 네이버페이 1010P |
| 최소 전환 금액 | 1000P | 최소 전환 가능 포인트 |
| 일일 요청 제한 | 1회 | 하루 1회만 요청 가능 |

### 2.5 다우기술 포인트 적립 API (내부 호출)

관리자 승인 시 서버에서 호출하는 다우기술 API.

- **엔드포인트**: `POST /v1/npay/point`
- **요청 파라미터**:

| 파라미터 | 암호화 | 설명 |
|--------|--------|------|
| userKey | O | 네이버페이 유니크 아이디 (계정 연결 시 저장한 값) |
| partnerTxNo | X | 제휴사 거래 번호 (고유값) |
| point | X | 적립 포인트 |

- **응답 (성공)**:

| 파라미터 | 설명 |
|--------|------|
| txNo | 다우기술 발급 적립 거래 번호 (취소 시 필요) |

> 📎 참고: 제휴사 API 연동 규격서 p.4 "네이버페이 포인트 적립"

#### partnerTxNo 생성 규칙

- **형식**: `yyMMddHHmmss` (Asia/Seoul) + 제휴사코드 + 영문/숫자 30자 이하
- 기존 거래 번호와 중복 불가
- 서버 시간과 1시간 이상 차이나면 실패

> 📎 참고: 제휴사 API 연동 규격서 p.4 partnerTxNo 형식
> 📎 참고: 제휴사 API 연동 규격서 p.6 에러코드 `41018` (서버시간과 1시간 이상 싱크 불일치)

### 2.6 예외 케이스 (적립 API 실패)

관리자 승인 후 다우기술 API 호출 실패 시 → 포인트 복원 + status → `failed`

| 에러코드 | 원인 |
|---------|------|
| `41019` | 월 적립 한도 초과 |
| `41020` | 일 적립 한도 초과 |
| `53001` | 네이버페이 보유 한도 초과 |
| `52001` | PG 회원 상태 비정상 |
| `42xxx` | PG사 통신 오류 |

> 📎 참고: 제휴사 API 연동 규격서 p.5-7 "전송 결과 코드"

### 2.7 저장 데이터

테이블: `naver_pay_exchanges`

| 컬럼 | 설명 |
|------|------|
| id | PK |
| user_id | 캐시모어 사용자 ID (FK) |
| naver_pay_account_id | 전환에 사용된 네이버페이 계정 (FK → naver_pay_accounts) |
| cashmore_point | 차감한 캐시모어 포인트 |
| naverpay_point | 전환될 네이버페이 포인트 |
| exchange_rate | 적용된 전환 비율 (요청 시점에 확정) |
| status | `pending` / `approved` / `completed` / `failed` / `cancelled` / `rejected` |
| point_action_id | 차감 포인트 액션 ID (FK → point_actions, 복원 시 참조) |
| partner_tx_no | 제휴사 거래 번호 (승인 시 생성) |
| tx_no | 다우기술 적립 거래 번호 (성공 시) |
| error_code | 실패 시 에러코드 |
| created_at | 요청 시각 |
| processed_at | 승인/거절/취소 처리 시각 |

### 2.8 포인트 차감/복원 처리

`PointService`를 통해 `point_actions` 테이블에 insert한다. 각 모듈이 직접 `point_actions`에 insert하지 않는다.

#### 차감 (전환 요청 시)

```
PointService.deductPoint(userId, 5000, 'EXCHANGE_POINT_TO_NAVERPAY', { exchange_id: "uuid" })
→ point_actions에 insert: { point_amount: -5000, type: 'EXCHANGE_POINT_TO_NAVERPAY', status: 'done', additional_data: { exchange_id: "uuid" } }
→ 반환: { pointActionId: 42 }
→ naver_pay_exchanges.point_action_id에 42 저장
```

#### 복원 (취소/거절/실패 시)

```
PointService.restorePoint(userId, 5000, 'EXCHANGE_POINT_TO_NAVERPAY', 42, { exchange_id: "uuid" })
→ point_actions에 insert: { point_amount: +5000, type: 'EXCHANGE_POINT_TO_NAVERPAY', status: 'done', additional_data: { exchange_id: "uuid", original_point_action_id: 42 } }
```

- `EXCHANGE_POINT_TO_NAVERPAY` 타입은 `POINT_ADD_TYPES`에 포함되어, done 상태일 때 포인트 잔액 계산에 자동 합산됨
- 차감(-5000) + 복원(+5000) = 0으로 정상 복원

---

## 3. 포인트 적립 취소

다우기술 API를 통해 이미 적립된 네이버페이 포인트를 취소할 수 있다.
1차 개발 범위에서는 제외하되, API 스펙은 기록해둔다.

### 3.1 적립 취소 API

- **엔드포인트**: `POST /v1/npay/point/cancel`

**요청:**

| 파라미터 | 타입 | 필수 | 암호화 | 설명 |
|---------|------|------|--------|------|
| userKey | text | O | O | 네이버페이 유니크 아이디 |
| txNo | number | O | X | 취소 대상의 다우기술 발급 적립 거래 번호 |

**응답 (성공):**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| cancel.point | number | 취소된 적립 포인트 |
| cancel.txNo | text | 다우기술 발급 취소 거래 번호 |

> 📎 참고: 제휴사 API 연동 규격서 p.4 "네이버페이 포인트 적립 취소"

### 3.2 망 취소 API

적립 처리 중 예외 발생 시 사용. 일반 취소 용도로 사용하지 않는다.

- **엔드포인트**: `POST /v1/npay/point/net-cancel`

**요청:**

| 파라미터 | 타입 | 필수 | 암호화 | 설명 |
|---------|------|------|--------|------|
| userKey | text | O | O | 네이버페이 유니크 아이디 |
| partnerTxNo | text | O | X | 취소 대상의 제휴사 거래 번호 |

**응답 (성공):**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| cancel.point | number | 취소된 적립 포인트 |
| cancel.txNo | text | 다우기술 발급 취소 거래 번호 |

> 📎 참고: 제휴사 API 연동 규격서 p.5 "네이버페이 포인트 적립 망 취소"
> ⚠️ "망 취소를 일반 적립 취소 용도로 사용하지 마십시오."

### 3.3 적립 내역 조회 (단건)

- **엔드포인트**: `POST /v1/npay/point/{적립 내역 조회}`

**요청:**

| 파라미터 | 타입 | 필수 | 암호화 | 설명 |
|---------|------|------|--------|------|
| partnerTxNo | text | O | X | 조회 대상의 제휴사 거래 번호 |

> ⚠️ 규격서에 응답 파라미터 상세가 누락되어 있음. 실제 연동 시 확인 필요.
> 📎 참고: 제휴사 API 연동 규격서 p.5 "네이버페이 포인트 적립 내역 조회 (단건)"

---

## 4. 공통 인프라

### 4.1 다우기술 API 공통 헤더

모든 API 호출 시 아래 헤더 필수:

```
pointbox-partner-code: {제휴사 코드}
Authorization: Bearer {Access Token}
Content-Type: application/json
```

> ⚠️ `Bearer`를 반드시 명시, `Bearer`와 Access Token 사이에 공백 필수

> 📎 참고: 제휴사 API 연동 규격서 p.1

### 4.2 접근 토큰 발급

Access Token은 유효 기간이 있으며, 만료 시 재발급 필요.

- **엔드포인트**: `POST /v1/auth/token`

**요청:**

| 파라미터 | 타입 | 필수 | 암호화 | 설명 |
|---------|------|------|--------|------|
| apiKey | text | O | X | 제휴사 등록 시 발급 받은 API 키 |

**응답 (성공):**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| accessToken | text | 접근 토큰 |
| expireIn | text | 접근 토큰의 유효 기간 |

**응답 (실패):**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| code | text | 실패 코드 |
| message | text | 실패 원인 설명 |

> 📎 참고: 제휴사 API 연동 규격서 p.2-3

### 4.3 암호화

- **알고리즘**: AES/CBC/PKCS5Padding
- **암호 키**: 제휴 시 별도 채널로 제공
- **IV**: 암호 키의 앞 16자리
- **암호화 대상**: 요청 파라미터 중 개인정보가 포함된 필드 (uniqueId, clientId, clientSecret, userKey, ci)

> 📎 참고: 제휴사 API 연동 규격서 p.1 "개인정보 암호화 규격"

### 4.4 도메인

| 환경 | 도메인 (규격서) | 실제 제공 도메인 | 포트 |
|------|----------------|-----------------|------|
| 개발 | test-box-api.coupop.co.kr | test-box-api.addcon.co.kr | 443 |
| 운영 | box-api.coupop.co.kr | (운영 시 확인 필요) | 443 |

> ⚠️ 규격서와 실제 제공된 도메인이 다름. 실제 제공된 도메인을 사용할 것.
> 📎 참고: 제휴사 API 연동 규격서 p.2 "도메인"

### 4.5 Rate Limit

- 인증되지 않은 요청 (토큰 발급): 1분당 10건
- 인증된 요청 (회원 조회, 적립/취소): 관리자 통해 제휴사에 설정된 값
- 초과 시 HTTP 429 반환

**응답 헤더:**

| 헤더 | 설명 |
|------|------|
| RateLimit-Limit | 적용된 Rate Limit 값 |
| RateLimit-Remaining | 남은 API 호출 수 |
| RateLimit-Reset | 갱신까지 남은 시간 (초) |

> 📎 참고: 제휴사 API 연동 규격서 p.1-2 "Rate Limit"

### 4.6 개발 환경 설정값

| 항목 | 값 |
|------|-----|
| 제휴사 코드 | `PAWPTE` |
| API 키 | config 파일 참고 (`naver-pay.config.ts`) |
| 암호 키 | config 파일 참고 |
| IV | 암호 키 앞 16자리 |
| 도메인 | `https://test-box-api.addcon.co.kr` |
| 네이버 로그인 키 | `.env` (`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`) |

---

## 부록: 다우기술 전송 결과 코드 전체

> 📎 참고: 제휴사 API 연동 규격서 p.5-7
> ⚠️ 아래 결과 코드는 추가 및 변경될 수 있음

### 서비스 오류

| 코드 | 설명 |
|------|------|
| 30000 | 내부 서비스 오류 |
| 30001 | 암호화 오류 |
| 30002 | 복호화 오류 |
| 30003 | 발송 전문 오류 |
| 30004 | 응답 전문 오류 |

### 인증

| 코드 | 설명 |
|------|------|
| 40000 | 인증 서비스 실패 |
| 40001 | 존재하지 않는 partnerCode |
| 40002 | apiKey 불일치 |
| 40003 | 허용 ip 미등록 |
| 40004 | 허용 되지 않은 ip 요청 |
| 40005 | 승인되지 않은 파트너 |
| 40010 | jwt 발급 실패 |
| 40011 | 유효하지 않은 partnerCode claims |
| 40012 | 유효하지 않은 jwt |
| 40013 | 만료된 jwt |
| 40014 | 지원하지 않는 jwt |
| 40015 | 비어있는 jwt |
| 40016 | 비어있는 Pointbox-Partner-Code 헤더 |
| 40017 | Pointbox-Partner-Code와 partnerCode claims 불일치 |
| 40018 | jwt 기타 에러 |
| 40019 | 잘못된 형식의 호출 URL |
| 40020 | 지원하지 않는 메소드 요청 |
| 40099 | 인증 기타 에러 |

### 유효성 검사

| 코드 | 설명 |
|------|------|
| 41000 | 유효성 체크 실패 |
| 41001 | 파라미터 복호화 실패 |
| 41002 | partnerTxNo 유효하지 않은 날짜 |
| 41003 | partnerTxNo 파트너 코드가 일치하지 않음 |
| 41004 | 중복된 partnerTxNo |
| 41005 | 존재하지 않는 TxNo |
| 41006 | 취소 권한 없음 |
| 41007 | 취소 가능 상태가 아님 |
| 41008 | 취소 가능 기간 초과 |
| 41009 | 존재하지 않는 partnerTxNo |
| 41010 | 요청 JSON 포맷 에러 |
| 41011 | 유효하지 않은 경로 요청 |
| 41012 | 유효하지 않은 메소드 요청 |
| 41013 | 취소 요청 미종료 (사업 담당자에게 문의) |
| 41014 | 이미 취소된 거래 |
| 41015 | 적립 요청 미종료 (취소 실패) |
| 41016 | 중복된 취소 요청 |
| 41017 | 지원되지 않는 미디어 유형 |
| 41018 | partnerTxNo의 날짜가 서버시간과 1시간 이상 싱크 불일치 |
| 41019 | 월 적립 한도 초과 |
| 41020 | 일 적립 한도 초과 |
| 41021 | 잘못된 헤더로 인한 요청 실패 |
| 41022 | 요청량 초과 |
| 41023 | 동일 거래 번호에 대한 취소 요청 간격이 짧음 |
| 41024 | 정산이 완료된 거래 (취소 불가) |

### PG사 통신

| 코드 | 설명 |
|------|------|
| 42000~42010 | PG사 통신 오류 |

### PG사 서비스

| 코드 | 설명 |
|------|------|
| 51001 | 서비스 오류 (통신 등) |
| 51002 | 파라미터 오류 |
| 51003 | 거래번호 오류 |
| 51004 | ACL 오류 |
| 51005 | 암호화 오류 |

### PG사 회원 상태

| 코드 | 설명 |
|------|------|
| 52001 | PG 회원 상태 비정상 (휴면) |
| 52002 | PG 회원 상태 비정상 (블랙) |
| 52003 | PG 계정 조회 일시 오류 |
| 52004 | PG 회원이 아님 (네이버페이 미가입) |

### PG사 포인트 적립/취소

| 코드 | 설명 |
|------|------|
| 53001 | 보유 한도 초과 |
| 53002 | 월 최대 충전한도 초과 |
| 53003 | 월 최대 충전횟수 초과 |
| 53004 | 일 최대 충전한도 초과 |
| 53005 | 일 최대 충전횟수 초과 |

### PG사 포인트 취소

| 코드 | 설명 |
|------|------|
| 54001 | 포인트 적립 취소시 원거래 없음 |
| 54002 | 이미 취소된 거래 |
| 54003 | 차감 가능 포인트 잔액 부족 |
| 54004 | 적립 요청 미종료 (취소 실패) |
