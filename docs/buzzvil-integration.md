# Buzzvil S2S API 연동 설계

## 1. 개요

Buzzvil 리워드 광고를 캐시모어 앱 **홈 화면 배너**에 연동한다.

**S2S(Server-to-Server) 호출이 필요한 API**:
- 광고 할당 요청 (`GET /api/s2s/ads`)
- 광고 참여 요청 (`POST /api/participate`)

**클라이언트에서 직접 호출 가능한 URL**:
- `impression_urls` (광고 노출 트래킹)
- `click_url` (노출형 광고 클릭)
- `check_participation_url` (액션형 참여 확인)

```
[앱] ──S2S──→ [백엔드] ──→ [Buzzvil]    광고 할당, 참여 요청
[앱] ──직접──→ [Buzzvil]                 impression, click, 참여 확인
[Buzzvil] ──→ [백엔드]                   포스트백 (포인트 적립)
```

### 광고 유형

| 분류 | 타입 | 리워드 조건 (`reward_condition`) |
|------|------|------|
| 노출형 | `cpc` (클릭형), `cpm` (노출형) | `"click"` - 클릭만으로 적립 |
| 액션형 | `cpa` (일반참여), `cpq`/`cpqlite` (퀴즈), `cpk` (카카오채널), `cpl` (페이스북좋아요), `cpyoutube` (유튜브구독), `cpylike` (유튜브구독+좋아요), `cpinsta` (인스타팔로우), `cps` (쇼핑), `cptiktok` (틱톡팔로우), `cpnstore` (네이버스토어알림), `cpe` (앱내이벤트), `cpcquiz` (퀴즈컨텐츠) | `"action"` - 미션 수행 후 적립 |

> 노출형이지만 `reward_condition`이 `"action"`인 광고도 존재할 수 있다. 분기 기준은 `type`이 아니라 **`click_url`의 존재 여부** 또는 **`reward_condition`** 값이다.

### 유저 식별

Buzzvil에 전달하는 `user_id`는 **auth_id** (Supabase Auth ID)를 사용한다.

- 탈퇴 후 재가입해도 동일 유저로 식별되어야 함 (Buzzvil 요구사항)
- 중복 참여 방지(에러코드 9020), 어뷰징 필터링에 활용됨
- 포스트백 수신 시 `auth_id → user_id` 매핑은 기존 `AuthService` (LRU Cache, TTL 1시간) 활용

### 광고식별자 (IFA)

- Android: GAID (Google Advertising ID) - `AdvertisingIdClient` 사용
- iOS: IDFA (Identifier for Advertisers) - `ATTrackingManager` + `ASIdentifierManager` 사용
- 앱에서 수집하여 서버에 전달
- **수집 불가 시**: `00000000-0000-0000-0000-000000000000`을 전달 (Buzzvil이 내부 대체식별자 생성)
- 형식: UUID (예: `ab4ade35-1c8a-4405-acda-10ca1ad1abe1`)

> **확인 필요**: 앱에 GAID/IDFA 수집 로직이 현재 구현되어 있는지 앱팀 확인 필요.

---

## 2. 전체 흐름

### 2-1. 노출형 광고 (cpc/cpm)

```
[앱]                          [백엔드]                 [Buzzvil]
  │                              │                        │
  │── GET /buzzvil/ads ────────→│── GET /s2s/ads ───────→│
  │←── 광고 목록 (3~5개) ──────│←── 광고 데이터 ────────│
  │                              │                        │
  │ (배너에 광고 노출됨)         │                        │
  │── impression_urls 직접 호출 ─────────────────────────→│
  │                              │                        │
  │ (유저가 광고 클릭)           │                        │
  │── click_url로 웹뷰 오픈 ─────────────────────────────→│
  │   (external_browser=true면   │                        │
  │    외부 브라우저)             │                        │
  │                              │                        │
  │                              │←── POST /postback ────│
  │                              │── point_actions INSERT │
  │                              │── 200 응답 ──────────→│
  │                              │                        │
  │ (다음 포인트 조회 시 반영)    │                        │
```

### 2-2. 액션형 광고 (cpa/cpq/cpk 등)

```
[앱]                          [백엔드]                 [Buzzvil]
  │                              │                        │
  │── GET /buzzvil/ads ────────→│── GET /s2s/ads ───────→│
  │←── 광고 목록 ──────────────│←── 광고 데이터 ────────│
  │                              │                        │
  │ (배너에 광고 노출됨)         │                        │
  │── impression_urls 직접 호출 ─────────────────────────→│
  │                              │                        │
  │ (유저가 광고 클릭)           │                        │
  │── POST /buzzvil/participate→│── POST /participate ──→│
  │←── 참여 설명 + landing_url ─│←── 참여 가능 응답 ─────│
  │                              │                        │
  │  참여 설명 페이지 표시        │                        │
  │  (action_description 내용)   │                        │
  │  CTA 버튼 클릭               │                        │
  │  → landing_url로 이동        │                        │
  │  → 미션 수행 (카톡채널추가 등)│                        │
  │                              │                        │
  │ (앱 복귀)                    │                        │
  │── check_participation_url 직접 호출 ─────────────────→│
  │←── { result: true } ────────────────────────────────│
  │                              │                        │
  │  "참여 완료! 포인트 적립 중..."│                       │
  │                              │                        │
  │── GET /reward-status ──────→│ (DB 조회)              │
  │←── { credited: false } ────│                        │
  │  (3초 대기)                  │                        │
  │                              │←── POST /postback ────│
  │                              │── point_actions INSERT │
  │── GET /reward-status ──────→│                        │
  │←── { credited: true, 50P } ─│                        │
  │                              │                        │
  │  "+50P 적립 완료!"           │                        │
```

**노출형 핵심**: `click_url`이 Buzzvil 리다이렉트 URL이므로, 앱이 직접 웹뷰/브라우저로 열면 된다.
**액션형 핵심**: `click_url`이 빈 문자열(`""`)이다. 대신 `participate` API를 호출해서 `landing_url`을 받아야 한다.

---

## 3. 백엔드 API 상세

### 3-1. 광고 할당 (S2S)

```
GET /buzzvil/ads
```

**인증**: JwtAuthGuard

**Buzzvil 호출**: `GET https://screen-api.buzzvil.com/api/s2s/ads`

**파라미터 구성**:

| 구분 | 파라미터 | 값/출처 | 필수 |
|------|---------|--------|------|
| 서버 설정 | `app_id` | 환경변수 `BUZZVIL_APP_ID` | O |
| 서버 설정 | `unit_id` | 환경변수 `BUZZVIL_UNIT_ID` | O |
| 서버 설정 | `country` | `"KR"` 고정 (국내 광고만 송출) | O |
| 서버 설정 | `target_fill` | `5` 고정 (배너용) | O |
| 서버 설정 | `revenue_types` | `["cpc","cpm","cpa","cpq","cpqlite","cpk","cpl","cpyoutube","cpylike","cpinsta","cps","cptiktok","cpnstore","cpe","cpcquiz"]` | O |
| 서버 매핑 | `user_id` | `auth_id` (JWT에서 추출) | O |
| 서버 추출 | `client_ip` | 요청 헤더에서 실제 IP 추출 | O |
| 앱 전달 | `ifa` | 광고식별자 (GAID/IDFA) | O |
| 앱 전달 | `platform` | `"A"` (Android) / `"I"` (iOS) | O |
| 앱 전달 | `birthday` | `"1993-01-09"` 형식 (YYYY-MM-DD) | 권장 |
| 앱 전달 | `gender` | `"M"` / `"F"` | 권장 |
| 앱 전달 | `carrier` | `"kt"` / `"skt"` / `"lgt"` | 권장 |
| 앱 전달 | `device_name` | 예: `"SM-G928L"` | 권장 |
| 앱 전달 | `user_agent` | User-Agent 문자열 | 권장 |
| 앱 전달 | `latitude` | 위도 (Float) | 권장 |
| 앱 전달 | `longitude` | 경도 (Float) | 권장 |
| 페이지네이션 | `cursor` | 이전 응답의 cursor 값 | 선택 |

> `birthday` 형식 주의: `1993-01-09` (O), `19930109` (X)
> 권장 파라미터를 많이 보낼수록 더 많은 광고가 할당된다.
> `revenue_types`는 URL 인코딩 필요: `%5B%22cpm%22%2C%22cpa%22%2C...%5D`

**Buzzvil 응답 예시**:

```json
{
  "code": 200,
  "msg": "ok",
  "cursor": "EvTIfLfbEUk7O...",
  "ads": [
    {
      "id": 10075328,
      "name": "11번가 신선밥상",
      "type": "cpc",
      "reward": 100,
      "reward_condition": "click",
      "impression_urls": [
        "https://ad.buzzvil.com/api/impression?data=ReOJjkH6mus..."
      ],
      "check_participation_url": "",
      "payload": "zh8qPfFDUycs3d...",
      "external_browser": false,
      "creative": {
        "title": "11번가 신선밥상",
        "description": "신선한 재료를 합리적인 가격에!",
        "click_url": "https://screen.buzzvil.com/api/s2s/click_redirect/?payload=eytY9...",
        "call_to_action": "더 알아보기",
        "width": 1200,
        "height": 627,
        "icon_url": "https://d3aulf22blzf9p.cloudfront.net/uploads/icon.png",
        "image_url": "https://d3aulf22blzf9p.cloudfront.net/uploads/image.jpg",
        "is_deeplink": false
      }
    }
  ]
}
```

> `click_url`이 빈 문자열이면 액션형, 값이 있으면 노출형.
> `check_participation_url`이 빈 문자열이면 노출형, 값이 있으면 액션형.
> `cursor`는 다음 광고 목록 요청 시 전달하면 기존 할당 광고를 제외한 새 광고를 받을 수 있다.

**우리 API 응답**: Buzzvil 응답을 그대로 전달 (필요 시 필드 가공).

---

### 3-2. 액션형 광고 참여 (S2S)

```
POST /buzzvil/participate
Body: {
  "campaign_id": 10075328,
  "payload": "zh8qPfFDUycs3d...",
  "device_name": "SM-G928L",
  "carrier": "kt"
}
```

**인증**: JwtAuthGuard

**Buzzvil 호출**: `POST https://screen-api.buzzvil.com/api/participate`

**Buzzvil 요청 구성**:

| 구분 | 위치 | 파라미터 | 값 |
|------|------|---------|-----|
| Header | `Buzz-App-ID` | | 환경변수 `BUZZVIL_APP_ID` |
| Header | `Buzz-Publisher-User-ID` | | `auth_id` |
| Header | `Buzz-IFA` | | 앱에서 전달받은 광고식별자 |
| Body | `unit_id` | | 환경변수 `BUZZVIL_UNIT_ID` |
| Body | `campaign_id` | | 앱에서 전달 (광고 `id` 필드) |
| Body | `custom` | | `auth_id` (유저 식별자) |
| Body | `client_ip` | | 요청 헤더에서 실제 IP 추출 |
| Body | `payload` | | 앱에서 전달 (광고 할당 시 받은 값) |
| Body | `device_name` | | 앱에서 전달 |
| Body | `carrier` | | 앱에서 전달 |

> Content-Type: `application/x-www-form-urlencoded` (JSON 아님 주의)

**Buzzvil 응답**:

```json
{
  "code": 200,
  "msg": "ok",
  "landing_url": "https://ad-api.buzzvil.com/action/land/cpq/browser?click_id=...",
  "revenue_type": "cpq",
  "action_description": "[참여방법]\n- 문제의 정답을 형식에 맞게 입력하시면 포인트가 지급됩니다.\n\n[주의사항]\n- 이미 참여한 문제는 포인트를 지급하지 않습니다.\n- 정답을 맞춘 후에는 반드시 '적립받기' 버튼을 눌러야 포인트가 지급됩니다.",
  "call_to_action": "퀴즈 맞추기",
  "image_url": "https://d3aulf22blzf9p.cloudfront.net/uploads/image.jpg"
}
```

**우리 API 응답**: `landing_url`, `action_description`, `call_to_action`, `image_url` 전달.

---

### 3-3. 포인트 적립 확인 (폴링)

```
GET /buzzvil/reward-status?campaign_id={id}
```

**인증**: JwtAuthGuard

**서버 동작**: `point_actions` 테이블에서 현재 유저(`auth_id` → `user_id` 매핑)의 해당 `campaign_id` 건 존재 여부 조회.

```sql
SELECT point_amount FROM point_actions
WHERE user_id = {user_id}
  AND additional_data->>'campaign_id' = {campaign_id}
  AND type = 'BUZZVIL_REWARD'
LIMIT 1
```

**우리 API 응답**:

```json
// 아직 적립 안 됨
{ "credited": false }

// 적립 완료
{ "credited": true, "point": 50 }
```

**클라이언트 폴링**: 3초 간격, 최대 30초 (약 10회). 30초 초과 시 "잠시 후 적립됩니다" 안내.

> 캠페인 참여는 유저당 1회이므로(중복 참여 시 9020 에러) `campaign_id` + `user_id`로 유일하게 특정 가능.

---

### 3-4. 포스트백 수신 (Buzzvil → 우리)

```
POST /buzzvil/postback
Content-Type: application/x-www-form-urlencoded
```

**인증**: JWT 없음. **IP Whitelist Guard**로 검증.

**허용 IP**:
- `13.231.21.93`
- `18.179.158.39`
- `52.68.114.43`

**수신 파라미터**:

| 필드 | 타입 | 설명 | 비고 |
|------|------|------|------|
| `user_id` | String(255) | **auth_id** | 우리가 ads API에 보낸 user_id |
| `transaction_id` | String(32) | 중복 방지용 고유 ID | 최대 32자, 중복 체크 필수 |
| `point` | Integer | 지급할 포인트 | |
| `unit_id` | Long | 광고 지면 ID | |
| `title` | String(255) | 광고 이름 | 광고 외(룰렛 등)는 빈값 |
| `event_at` | Long | 포인트 지급 시점 | UNIX Timestamp 초단위 |
| `action_type` | String(32) | 유저 액션 타입 | 아래 표 참고 |
| `revenue_type` | String(32) | 광고 유형 | cpc, cpm, cpa 등 |
| `campaign_id` | Long | 캠페인 ID | |
| `extra` | String(1024) | 추가 데이터 | JSON 문자열 |
| `data` | String | 암호화된 파라미터 | AES 암호화 시 사용 |
| `c` | String | Checksum | HMAC 검증 시 사용 |
| `custom2` | String(255) | 커스텀 파라미터 | participate 시 전달한 값 |
| `custom3` | String(255) | 커스텀 파라미터 | |
| `custom4` | String(255) | 커스텀 파라미터 | |

**`action_type` 값 목록**:

| 값 | 설명 |
|----|------|
| `l` | 랜딩 (광고 클릭) |
| `a` | 액션 완료 |
| `opened` | Feed 지면 진입 |
| `u` | 잠금 해제 |
| `p` | 컨텐츠 참여 |
| `won` | Potto 당첨 |
| `manual` | 담당자 수기 적립 |
| `spinned` | 룰렛 참여 |
| `daily` | Feed 출석체크 |
| `attended` | 프로모션 출석체크 |
| `benefit_luckybox` | 럭키박스 |
| `benefit_missionpack` | 미션팩 특별 보상 |
| `benefit_missionpack_task` | 미션팩 미션별 보상 |
| `benefit_scroll_mission` | 스크롤 미션 |

**처리 흐름**:

```
1. IP Whitelist 검증
   → 허용 IP가 아니면 403 Forbidden

2. (선택) HMAC 검증
   → hmac_key로 "{campaign_id}:{user_id}:{point}:{transaction_id}" 해싱
   → 포스트백의 `c` 필드와 비교
   → 불일치 시 403

3. transaction_id 중복 체크 (atomic)
   → 이미 존재하면 409 Conflict 응답 (Buzzvil은 성공으로 처리)

4. auth_id → user_id 매핑 (AuthService)
   → 매핑 실패 (탈퇴 유저) → 200 응답하되 적립 안 함
   → Buzzvil 재시도를 멈추기 위해 반드시 200 응답

5. point_actions INSERT
   → type: BUZZVIL_REWARD
   → point_amount: 포스트백의 point 값
   → additional_data: { transaction_id, campaign_id, action_type, revenue_type, title, unit_id }

6. 200 OK 응답
```

**우리가 응답해야 하는 HTTP 상태 코드**:

| 응답 코드 | 의미 | Buzzvil 동작 |
|-----------|------|------------|
| **200** (OK) | 적립 성공 | 재시도 안 함 |
| **204** (No Content) | 적립 성공 | 재시도 안 함 |
| **409** (Conflict) | 이미 처리된 건 | 재시도 안 함 |
| 그 외 | 실패 | **최대 5회 재시도** (1분 → 10분 → 1시간 → 3시간 → 24시간) |

> 서버 에러(500) 발생 시 Buzzvil이 24시간에 걸쳐 재시도하므로, 포스트백 엔드포인트는 최대한 안정적으로 구현해야 한다.

**포스트백 검증 방식 (선택, 2가지)**:

**방식 1: HMAC SHA-256 Checksum**
- 포스트백의 `c` 필드와 HMAC 계산값 비교
- key: Buzzvil에서 발급받은 `hmac_key` (64자)
- data: `{campaign_id}:{user_id}:{point}:{transaction_id}`
- 결과값 길이: 64자

**방식 2: AES-256-CBC 암호화**
- 포스트백의 `data` 필드에 암호화된 전체 파라미터가 전달됨
- 복호화 순서: base64 decoding → AES-256-CBC 복호화 (PKCS7 패딩 제거) → UTF-8 디코딩
- key/IV: Buzzvil에서 발급

---

## 4. 클라이언트 구현 가이드

### 4-1. 홈 화면 배너 로딩

광고는 홈 로딩과 **독립적으로 비동기 로드**한다. Buzzvil 장애 시에도 홈 화면은 정상 동작해야 한다.

```
홈 화면 로드
  ├── 포인트, 출석, 기타 컨텐츠 → 즉시 렌더링
  │
  └── 광고 배너 영역
       → 스켈레톤 표시
       → 비동기 GET /buzzvil/ads
       → 성공 → 배너 표시
       → 실패 → 영역 숨김 (홈에 영향 없음)
```

### 4-2. 광고 캐싱 & 갱신

```
앱 실행 or 홈 최초 진입 → GET /buzzvil/ads → state에 저장 + 타임스탬프 기록

홈 재진입 시:
  ├── 캐시 5분 이내 → 캐시된 광고 표시 (API 호출 안 함)
  └── 캐시 5분 초과 → 새로 요청

앱 백그라운드 → 포그라운드 복귀:
  ├── 5분 이내 → 기존 광고 유지
  └── 5분 초과 → 새로 요청
```

> 5분은 우리가 정한 임의 TTL. Buzzvil은 광고 만료 시간을 제공하지 않는다.
> 광고 만료(예산 소진, 캠페인 중단 등)는 클릭 시 에러 코드로만 알 수 있다.
> 배너에 3~5개 광고를 띄우는 수준이면 5분 내에 전부 소진될 가능성은 낮다.

### 4-3. 배너 캐러셀

광고 3~5개를 슬라이드로 표시한다.

```
[광고1] ──(3~5초)──→ [광고2] ──(3~5초)──→ [광고3] ──→ 처음으로
```

**광고 소재 데이터 (배너 UI 구성)**:

| 필드 | 설명 | 비고 |
|------|------|------|
| `creative.image_url` | 광고 이미지 | 1200x627 고정, **종횡비 유지 필수** |
| `creative.title` | 제목 | 최대 10자, 초과 시 생략 부호 처리 |
| `creative.description` | 상세 설명 | 최대 40자, 초과 시 생략 부호 처리 |
| `creative.icon_url` | 광고주 아이콘 | 종횡비 유지 필수 |
| `creative.call_to_action` | CTA 버튼 텍스트 | 최대 7자, 예: "더 알아보기", "퀴즈 맞추기" |
| `reward` | 리워드 금액 | "+50P" 형태로 표시 |
| `type` | 광고 유형 | UI 배지 표시용 (예: "퀴즈", "카카오채널") |

> 모든 소재 데이터는 빠짐없이 필수로 UI에 표시해야 한다 (Buzzvil 가이드라인).

### 4-4. Impression 호출 (클라이언트 직접)

**호출 시점**: 광고 이미지가 화면에 **50% 이상 노출**되었을 때.

**규칙**:
- **클라이언트가 Buzzvil URL을 직접 GET 호출** (백엔드 프록시 안 함)
- 광고별 **1회만** 호출. 같은 광고가 캐러셀에서 다시 보여도 중복 호출하지 않는다.
- `impression_urls` 배열의 URL을 **전부** 호출한다. (2개 이상일 수 있음: Buzzvil 트래킹 + 제3자 트래킹)
- 모든 광고 유형(cpc, cpm, cpa 등)에 대해 호출해야 한다. CPM만 해당되는 것이 아님.
- 호출 실패 시 무시 (UX에 영향 주지 않음)

```javascript
// 클라이언트 의사코드
const impressionSent = new Set(); // 광고 ID별 트래킹

function onAdVisible(ad) {
  if (impressionSent.has(ad.id)) return;

  // 백엔드를 거치지 않고 직접 호출
  ad.impression_urls.forEach(url => fetch(url));

  impressionSent.add(ad.id);
}
```

**impression 호출이 필요한 이유**:
- CPM 광고의 매출 집계 (호출 안 하면 매출 안 잡힘)
- 유저의 광고 노출 이력 추적 (디버깅용)
- Buzzvil 어드민 통계 집계

### 4-5. 광고 클릭 분기

```
유저가 배너 클릭
  │
  ├─ click_url이 있다 (노출형: cpc/cpm)
  │   │
  │   ├─ external_browser = true
  │   │   → 외부 브라우저로 click_url 오픈 (클라이언트 직접)
  │   │
  │   └─ external_browser = false
  │       → 인앱 웹뷰로 click_url 오픈 (클라이언트 직접)
  │
  └─ click_url이 없다 (액션형)
      → POST /buzzvil/participate 호출 (백엔드 경유, S2S)
      │
      ├─ code: 200 (참여 가능)
      │   → 참여 설명 페이지 표시
      │     - action_description 내용 표시 (줄바꿈 \n 처리)
      │     - image_url 표시
      │     - CTA 버튼: call_to_action 텍스트 사용
      │   → CTA 버튼 클릭 시 landing_url로 이동
      │
      ├─ code: 9020 → "이미 참여한 광고에요"
      ├─ code: 9021 → "이 광고는 마감되었어요"
      ├─ code: 9013 → "이 광고는 마감되었어요"
      └─ 기타 에러 → "잠시 후 다시 시도해주세요"
```

> `creative.is_deeplink`가 `true`이면 리다이렉트 최종 URL이 딥링크일 수 있으므로 앱에서 처리 필요.

### 4-6. 노출형 광고 - Custom Parameter (선택)

노출형 광고의 `click_url`에 커스텀 파라미터를 추가할 수 있다. 포스트백 시 이 값이 함께 전달된다.

```
click_url + "&custom=" + encodeURIComponent(JSON.stringify({ clickId: "sample-id" }))
```

### 4-7. 액션형 광고 - 앱 복귀 후

```
앱 복귀 감지 (AppState change 등)
  │
  ├── 1단계: 참여 확인 (클라이언트 직접 호출)
  │   GET {check_participation_url}  ← 광고 할당 시 받은 URL 그대로
  │     → { result: true }  → "참여 완료! 포인트 적립 중..." UI 표시
  │     → { result: false } → "참여가 확인되지 않았어요. 다시 시도해주세요"
  │
  └── 2단계: 포인트 적립 폴링 (result: true일 때만, 백엔드 호출)
        → GET /buzzvil/reward-status?campaign_id={광고 id}
        → 3초 간격, 최대 30초 (약 10회)
        → credited: true  → "+50P 적립 완료!" UI + 포인트 잔액 갱신
        → 30초 초과       → "포인트는 잠시 후 적립됩니다" 안내
```

### 4-8. 에러 처리

| 상황 | 앱 처리 |
|------|--------|
| 광고 로딩 실패 / Buzzvil 장애 | 배너 영역 숨김. 홈 나머지 컨텐츠 정상 표시 |
| 광고 응답이 빈 배열 (할당 가능 광고 없음) | 배너 영역 숨김 |
| 클릭 시 캠페인 소진 (9021) | "이 광고는 마감되었어요" 토스트, 해당 광고 리스트에서 제거 |
| 클릭 시 캠페인 비활성 (9013) | "이 광고는 마감되었어요" 토스트, 해당 광고 리스트에서 제거 |
| 이미 참여 (9020) | "이미 참여한 광고에요" 안내, 해당 광고 리스트에서 제거 |
| 블랙리스트 유저 (401) | "참여가 제한된 광고입니다" 안내 |
| 타게팅 불일치 (9037) | "참여 조건에 맞지 않아요" 안내 |
| 광고식별자 오류 (9040) | 광고ID 설정 안내 팝업 (Android) |
| 참여 확인 false | "참여가 확인되지 않았어요. 다시 시도해주세요" |
| 적립 폴링 타임아웃 | "포인트는 잠시 후 적립됩니다" |
| 네트워크 에러 (impression, 폴링 등) | 무시 (UX에 영향 주지 않음) |

---

## 5. 데이터

### point_actions (기존 테이블 활용)

```
type: 'BUZZVIL_REWARD'
user_id: '{내부 user_id}'
point_amount: 50
status: 'completed'
additional_data: {
  "transaction_id": "abc123def456",
  "campaign_id": 10075328,
  "action_type": "a",
  "revenue_type": "cpa",
  "title": "11번가 신선밥상",
  "unit_id": 13489599724091,
  "event_at": 1700000000
}
```

- `transaction_id`로 중복 체크 → 이중 적립 방지
- `campaign_id`로 폴링 조회
- 별도 테이블 추가 없이 기존 구조 활용

### PointActionType 추가

```typescript
BUZZVIL_REWARD = 'BUZZVIL_REWARD'  // ADD_TYPES에 추가
```

---

## 6. 환경 변수

```env
# Buzzvil 연동
BUZZVIL_APP_ID=                    # 매체 앱 ID (Buzzvil 담당자에게 발급)
BUZZVIL_UNIT_ID=                   # 매체 지면 ID (Buzzvil 담당자에게 발급)
BUZZVIL_API_BASE_URL=https://screen-api.buzzvil.com    # 운영
# BUZZVIL_API_BASE_URL=https://screen-api-staging.buzzvil.com  # 스테이징
BUZZVIL_POSTBACK_WHITELIST_IPS=13.231.21.93,18.179.158.39,52.68.114.43
BUZZVIL_HMAC_KEY=                  # 포스트백 HMAC 검증용 (선택, Buzzvil에서 발급)
```

---

## 7. 보안

| 항목 | 처리 |
|------|------|
| 앱 → 백엔드 (ads, participate, reward-status) | `JwtAuthGuard` (기존) |
| 포스트백 엔드포인트 | JWT 제외, **IP Whitelist Guard** |
| 포스트백 검증 (선택) | HMAC SHA-256 checksum 또는 AES-256-CBC 복호화 |
| `app_id`, `unit_id` | 서버 환경변수에서만 관리, 앱에 노출 안 함 |
| `client_ip` | 서버에서 요청 헤더로부터 추출, 앱이 위조 불가 |
| Buzzvil 서버 IP 고정 (필요 시) | `13.230.245.160`, `43.206.81.155` (포트 443) |

---

## 8. 모듈 구조

```
src/buzzvil/
├── dto/
│   ├── get-ads.dto.ts                  # 광고 할당 요청/응답 DTO
│   ├── participate.dto.ts              # 참여 요청/응답 DTO
│   ├── reward-status.dto.ts            # 적립 확인 응답 DTO
│   └── postback.dto.ts                 # 포스트백 수신 DTO
├── guards/
│   └── ip-whitelist.guard.ts           # 포스트백 IP 검증 Guard
├── interfaces/
│   └── buzzvil-repository.interface.ts # Repository 인터페이스 + Symbol 토큰
├── repositories/
│   ├── supabase-buzzvil.repository.ts  # 프로덕션 (포스트백 저장, 중복 체크)
│   └── stub-buzzvil.repository.ts      # 단위 테스트 (in-memory)
├── buzzvil.module.ts                   # 모듈 정의 + DI 설정
├── buzzvil.controller.ts               # HTTP 엔드포인트 + Swagger
├── buzzvil.service.ts                  # 비즈니스 로직
└── buzzvil-api.service.ts              # Buzzvil 외부 API 호출 전담
```

---

## 9. 구현 순서

1. `@nestjs/axios` HttpModule 추가
2. `buzzvil.module` + `buzzvil-api.service` (Buzzvil API 호출 서비스)
3. 광고 할당 API (`GET /buzzvil/ads`)
4. 포스트백 수신 API + IP Whitelist Guard (`POST /buzzvil/postback`)
5. 포인트 적립 확인 API (`GET /buzzvil/reward-status`)
6. participate API (`POST /buzzvil/participate`)
7. 단위 테스트 (StubRepository)
8. E2E 테스트

---

## 10. Buzzvil 에러 코드 전체 참조

### 광고 할당 (GET /api/s2s/ads)

> 이 코드들은 HTTP status가 아니라 응답 body의 `code` 필드로 내려온다.

| 코드 | 설명 |
|------|------|
| 200 | 정상 |
| 1000 | 시스템 에러 |
| 9001 | 존재하지 않는 unit_id |
| 9004 | 유효하지 않은 파라미터 (필수 필드 누락) |
| 9011 | unit이 inactive 상태 |

### 광고 참여 (POST /api/participate)

| 코드 | 설명 | 앱 처리 |
|------|------|--------|
| 200 | 참여 가능 | 정상 플로우 |
| 401 | 블랙리스트 유저 | "참여가 제한되었습니다" |
| 402 | 잘못된 IP 주소 형식 | 서버 설정 확인 |
| 1000 | 시스템 에러 | "잠시 후 다시 시도해주세요" |
| 9001 | 존재하지 않는 unit_id | 서버 설정 확인 |
| 9004 | 유효하지 않은 파라미터 | 서버 설정 확인 |
| 9008 | 존재하지 않는 캠페인 | 광고 리스트에서 제거 |
| 9011 | unit이 inactive | 서버 설정 확인 |
| 9013 | 비활성화된 캠페인 | "마감된 광고" + 리스트에서 제거 |
| 9014 | 라이브 중이 아니거나 타게팅 안 됨 | "마감된 광고" + 리스트에서 제거 |
| 9020 | 이미 참여한 캠페인 | "이미 참여한 광고에요" |
| 9021 | 캠페인 소진 | "마감된 광고" + 리스트에서 제거 |
| 9022 | 광고식별자 필수 캠페인인데 식별자 없음 | 광고ID 설정 안내 |
| 9031 | 알 수 없는 애드네트워크 에러 | "잠시 후 다시 시도해주세요" |
| 9037 | 타게팅 조건 불일치 | "참여 조건에 맞지 않아요" |
| 9040 | 광고식별자 형식 오류 | 광고ID 설정 안내 |

---

## 11. 문의하기 페이지 (선택)

Buzzvil에서 제공하는 CS 페이지. **외부 브라우저**로 열어야 한다. 클라이언트에서 직접 호출 가능.

```
GET https://screen-api.buzzvil.com/api/inquiries/page
  ?app_id={BUZZVIL_APP_ID}
  &puid={auth_id}
  &ifa={광고식별자}
  &unit_ids={BUZZVIL_UNIT_ID}
```

> `app_id`가 필요하므로 백엔드에서 URL을 생성해서 앱에 전달하거나, 앱에 `app_id`를 노출해야 한다. 보안상 백엔드에서 URL을 생성하는 편이 낫다.

---

## 12. Meta API (선택)

유저의 최대 적립 가능 금액과 IFA 변경 여부를 확인할 수 있다.

```
GET https://screen-api.buzzvil.com/api/s2s/ads/meta
```

파라미터: 광고 할당 API와 동일.

**응답**:

```json
{
  "code": 200,
  "message": "ok",
  "result": {
    "total_reward": 97215,
    "is_modified_ifa": false
  }
}
```

- `total_reward`: 최대 적립 가능 리워드
- `is_modified_ifa`: IFA 변경 여부 (`true`이면 변경 있었음)

홈 배너에 "오늘 최대 OO원 적립 가능" 같은 UI를 보여줄 때 활용 가능.
