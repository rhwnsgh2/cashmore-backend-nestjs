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
| **동작** | connected row의 status를 `disconnected`로 변경 (row 삭제하지 않음) |
| **연결된 계정 없을 시** | 에러 반환 |
| **pending 전환 요청 있을 시** | pending 요청 자동 취소 (cancelled + 포인트 복원) 후 해제 진행 |
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
| naver_unique_id | 네이버 로그인 유니크 아이디 |
| dau_user_key | 네이버페이 유니크 아이디 (적립 시 사용, 성공 시) |
| dau_masking_id | 마스킹된 네이버 아이디 (UI 표시용, 성공 시) |
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

기존 현금 출금(exchange_point) 로직과 동일한 패턴.
사용자가 요청하면 포인트를 즉시 차감하고, 관리자 승인 후 네이버페이 적립을 진행한다.

### 2.1 전체 흐름

```
[유저 전환 요청]
  앱 → 서버: POST /naverpay/exchange { point }
  서버: 검증 (계정 연결 확인, 최소 금액, 일일 제한, 잔액 확인)
  서버: 캐시모어 포인트 즉시 차감 + exchange row 생성 (pending)
  서버 → 앱: { exchangeId, status: "pending" }

[유저 전환 취소]
  앱 → 서버: DELETE /naverpay/exchange/:id
  서버: pending 상태 확인 → 포인트 복원 + status → cancelled
  서버 → 앱: { success: true }

[관리자 승인]
  관리자 → 서버: 승인 처리
  서버: partnerTxNo 생성 → 다우기술 적립 API 호출
  성공 → txNo 저장, status → completed
  실패 → 포인트 복원, status → failed, error_code 저장

[관리자 거절]
  관리자 → 서버: 거절 처리
  서버: 포인트 복원, status → rejected
```

### 2.2 상태 흐름

```
pending → approved → completed (적립 성공)
                   → failed (적립 API 실패 → 포인트 복원)
        → cancelled (유저 본인 취소 → 포인트 복원)
        → rejected (관리자 거절 → 포인트 복원)
```

### 2.3 캐시모어 API

#### `POST /naverpay/exchange` — 전환 요청

| | |
|---|---|
| **전제 조건** | 네이버페이 계정 connected 상태 |
| **요청** | `{ "point": 5000 }` |
| **내부 동작** | 검증 → 포인트 차감 → exchange row 생성 (트랜잭션) |

**검증 항목:**

| 검증 | 실패 시 |
|------|--------|
| 네이버페이 계정 연결 확인 | "네이버페이 계정을 먼저 연결해주세요" |
| 최소 전환 금액 (1,000P) | "최소 1,000P부터 전환 가능합니다" |
| 일일 요청 제한 (1회) | "오늘 이미 전환 요청을 하셨습니다" |
| 보유 포인트 잔액 | "포인트가 부족합니다" |

```json
// 성공
{ "success": true, "data": { "exchangeId": "uuid", "cashmorePoint": 5000, "naverpayPoint": 5000, "status": "pending" } }
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

환경설정 테이블(DB)에서 관리. 앱 업데이트 없이 서버에서 변경 가능. (환경설정 테이블은 신규 생성 필요)

| 설정 키 | 초기값 | 설명 |
|--------|--------|------|
| `npay_exchange_rate` | 1 | 캐시모어 포인트 : 네이버페이 포인트 비율 |
| `npay_min_point` | 1000 | 최소 전환 가능 포인트 |
| `npay_daily_limit` | 1 | 하루 요청 가능 횟수 |

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
| partner_tx_no | 제휴사 거래 번호 (승인 시 생성) |
| tx_no | 다우기술 적립 거래 번호 (성공 시) |
| error_code | 실패 시 에러코드 |
| created_at | 요청 시각 |
| processed_at | 승인/거절/취소 처리 시각 |

---

## 3. 포인트 적립 취소

다우기술 API를 통해 이미 적립된 네이버페이 포인트를 취소할 수 있다.
1차 개발 범위에서는 제외하되, API 스펙은 기록해둔다.

### 3.1 적립 취소 API

- **엔드포인트**: `POST /v1/npay/point/cancel`
- **요청**: userKey (암호화), txNo (적립 거래 번호)
- **응답**: cancel.point (취소된 포인트), cancel.txNo (취소 거래 번호)

> 📎 참고: 제휴사 API 연동 규격서 p.4 "네이버페이 포인트 적립 취소"

### 3.2 망 취소 API

적립 처리 중 예외 발생 시 사용. 일반 취소 용도로 사용하지 않는다.

- **엔드포인트**: `POST /v1/npay/point/net-cancel`
- **요청**: userKey (암호화), partnerTxNo (제휴사 거래 번호)

> 📎 참고: 제휴사 API 연동 규격서 p.5 "네이버페이 포인트 적립 망 취소"
> ⚠️ "망 취소를 일반 적립 취소 용도로 사용하지 마십시오."

---

## 4. 공통 인프라

### 4.1 다우기술 API 인증

- 헤더: `pointbox-partner-code: {제휴사 코드}`
- 인증: `Authorization: Bearer {Access Token}`
- Access Token은 `/v1/auth/token` API로 발급, 만료 시 재발급 필요

> 📎 참고: 제휴사 API 연동 규격서 p.1-2 "공통 가이드"

### 4.2 암호화

- 알고리즘: AES/CBC/PKCS5Padding
- 암호 키 및 IV: 제휴 시 별도 채널로 제공

> 📎 참고: 제휴사 API 연동 규격서 p.1 "개인정보 암호화 규격"

### 4.3 도메인

| 환경 | 도메인 | 포트 |
|------|--------|------|
| 개발 | test-box-api.coupop.co.kr | 443 |
| 운영 | box-api.coupop.co.kr | 443 |

> 📎 참고: 제휴사 API 연동 규격서 p.2 "도메인"

### 4.4 Rate Limit

- 인증되지 않은 요청: 1분당 10건
- 인증된 요청: 제휴사별 설정값
- 초과 시 HTTP 429 반환

> 📎 참고: 제휴사 API 연동 규격서 p.1-2 "Rate Limit"
