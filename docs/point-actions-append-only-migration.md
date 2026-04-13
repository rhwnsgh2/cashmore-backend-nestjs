# point_actions Append-Only 전환 및 Admin 이관 계획

## 배경

`point_actions` 테이블은 원래 원장(ledger) 성격으로 설계됐지만, 일부 경로에서 DELETE/UPDATE가 섞여 있어 append-only 원칙이 깨져 있다. 이는 향후 `user_point_balance` 같은 잔액 캐시 테이블을 도입할 때 "insert만 신경 쓰면 되는" 단순한 구조를 만들 수 없게 만든다.

조사 결과, 전체 코드베이스에서 `point_actions` mutation 지점은 다음과 같다.

**백엔드 (cashmore-backend-nestjs):**
- DELETE 1곳: `every-receipt.service.ts#requestReReview` (유저 재검수 요청 시 포인트 환수)
- UPDATE 0곳
- INSERT 다수 (9개 모듈)

**cash-more-web (admin 경로):**
- DELETE: `/app/api/admin/every_receipt/[id]/delete` — admin 영수증 삭제
- UPDATE: `/app/admin/every_receipt/serverActions/saveEveryReceiptPoint` — admin 포인트 수정
- INSERT: `/app/api/every_receipt/re_review/complete` — admin 재검수 완료

cash-more-web의 나머지 `point_actions` mutation은 모두 유저 경로이며 이미 NestJS 백엔드로 이관 완료되어 dead code 상태다. 이관이 남은 실질 경로는 **admin 영수증 삭제 / 포인트 수정 / 재검수 완료** 3개뿐이다.

exchange-point 모듈이 이미 동일한 패턴(append-only 원장 + 별도 state 테이블)을 사용 중이므로, every-receipt도 같은 컨벤션으로 전환해 일관성을 확보한다.

## 목표

1. `point_actions`를 완전한 append-only 원장으로 전환한다.
2. cash-more-web의 admin 직접 DB 쓰기를 제거하고, 백엔드 API 호출로 일원화한다.
3. every-receipt의 포인트 생애주기를 원장에서 추적 가능하게 만든다.

## 비목표

- `user_point_balance` 테이블 구축 (별도 단계)
- 나머지 모듈의 insert를 `PointWriteService`로 중앙화 (별도 단계, Phase B)
- `point-batch` 모듈의 `deleteExpirationActions` 전환 (별도 단계)
- admin UI 자체의 이관 (cash-more-web의 admin 페이지는 그대로 유지)

## 설계 결정

### 원장 스키마 컨벤션

모든 행은 **동일한 `type = 'EVERY_RECEIPT'`**, **동일한 `status = 'done'`**을 유지한다. 구분은 `additional_data` JSON의 `reason` 필드로 한다. `point_actions` 테이블 스키마는 변경하지 않는다.

```json
// 1. 영수증 완료 (원본)
{ "every_receipt_id": 123 }

// 2. 유저 재검수 요청 (포인트 환수)
{
  "every_receipt_id": 123,
  "every_receipt_re_review_id": 456,
  "reason": "user_review"
}

// 3a. 재검수 거부 — 원래 포인트 재지급
{
  "every_receipt_id": 123,
  "every_receipt_re_review_id": 456,
  "reason": "re_review_rejected"
}

// 3b. 재검수 승인 — 새 포인트 지급
{
  "every_receipt_id": 123,
  "every_receipt_re_review_id": 456,
  "reason": "re_review_approved"
}

// 4. admin 포인트 수정 (delta 방식)
{
  "every_receipt_id": 123,
  "reason": "admin_adjust",
  "before_point": 5,
  "after_point": 8
}

// 5. admin 영수증 삭제
{
  "every_receipt_id": 123,
  "reason": "admin_delete"
}
```

### reason 값 정의

| reason | 의미 | point_amount |
|---|---|---|
| (없음) | 최초 완료 지급 | +point (양수) |
| `user_review` | 유저의 재검수 요청으로 포인트 환수 | `-every_receipt.point` (음수) |
| `re_review_rejected` | 재검수 거부로 원 포인트 재지급 | `+beforePoint` (양수) |
| `re_review_approved` | 재검수 승인으로 상향 포인트 지급 | `+afterPoint` (양수) |
| `admin_adjust` | 관리자 포인트 수정 (delta) | `newPoint - oldPoint` (±) |
| `admin_delete` | 관리자 영수증 삭제 시 포인트 상쇄 | `-every_receipt.point` (음수) |

### 공통 키와 체인

- 같은 영수증의 모든 행은 `additional_data.every_receipt_id`로 묶인다. 별도 `original_point_action_id`는 두지 않는다 (`every_receipt_id` 자체가 공통 키 역할).
- 재검수 플로우(2, 3a, 3b)는 `every_receipt_re_review_id`로 특정 재검수 요청과 연결된다.

### "현재 유효 포인트"의 진실 소스

- `every_receipt.point` 컬럼을 "해당 영수증이 현재 기여해야 할 포인트"의 진실 소스로 삼는다.
- **불변식**: `every_receipt.status = 'completed'`인 동안, `SUM(해당 every_receipt_id의 point_actions)` = `every_receipt.point`
- admin 작업 시 `every_receipt.point`를 읽어 delta를 계산한다. 별도 SUM 쿼리 불필요.

### admin 포인트 수정 전략

delta 방식(B2)을 채택한다. 고빈도 작업이라 행 수를 최소화한다.

```
oldPoint = every_receipt.point
delta = newPoint - oldPoint
if status === 'completed' and delta !== 0:
  INSERT point_actions(+delta, reason='admin_adjust', before_point=oldPoint, after_point=newPoint)
UPDATE every_receipt SET point=newPoint
```

### 기존 `point_actions.updated_at` 컬럼

- 컬럼은 그대로 유지한다 (삭제 시 의미가 커 보이지 않음).
- append-only 전환 후에는 사실상 `created_at`과 동일하게 유지되며, 기존 UPDATE 경로가 없어지므로 드리프트 가능성 없음.

## Stage 1: 백엔드 — 유저 재검수 요청 append-only 전환

### 범위

`every-receipt.service.ts#requestReReview`의 `deletePointAction` 호출을 reversal INSERT로 교체한다.

cash-more-web은 건드리지 않는다. 이 단계는 **백엔드 단독 배포**가 가능하며 기존 cash-more-web admin 흐름과 충돌하지 않는다 (admin 재검수 완료는 추가 INSERT만 하므로 net-effect가 맞는다).

### 수정할 파일

1. **`src/every-receipt/every-receipt.service.ts`**
   - `requestReReview` 내부: `deletePointAction(userId, receiptId)` 호출 제거
   - 대신 `insertPointReversal` 신규 메서드 호출 — `-every_receipt.point`, `additional_data: { every_receipt_id, every_receipt_re_review_id, reason: 'user_review' }`
   - 호출 전 `every_receipt.point`를 읽어야 하므로 `findEveryReceiptForReReview`의 반환 타입에 `point` 포함 필요

2. **`src/every-receipt/interfaces/every-receipt-repository.interface.ts`**
   - 신규 메서드: `insertPointAction(params)` (reason 포함)
   - 신규 메서드: `deleteReceipt(receiptId)` (Stage 2에서 함께 사용)
   - 신규 메서드: `updateReceiptPoint(receiptId, newPoint)` (Stage 2에서 함께 사용)
   - 기존 `deletePointAction`: **이 단계에서는 제거하지 않음**. Stage 3 완료 후 제거
   - 기존 `findEveryReceiptForReReview`의 반환 타입에 `point` 추가

3. **`src/every-receipt/repositories/supabase-every-receipt.repository.ts`**
   - 신규 메서드 구현 (Supabase 클라이언트)

4. **`src/every-receipt/repositories/stub-every-receipt.repository.ts`**
   - 동일 메서드 stub 구현

### 테스트

5. **`src/every-receipt/every-receipt.service.spec.ts`**
   - `requestReReview` 단위 테스트 수정: DELETE 대신 reversal INSERT를 확인
   - point_actions에 `(+point)`와 `(-point)` 두 행이 존재하고 SUM이 0인지 검증
   - `additional_data`의 `reason`, `every_receipt_re_review_id` 확인

6. **`test/every-receipt.e2e.spec.ts`**
   - 동일한 시나리오를 실 Supabase 대상으로 검증
   - 재검수 요청 후 `point_actions` 행 수, SUM, `every_receipt.status` 변화 확인

### 배포 / 롤백

- 단독 배포 가능.
- 롤백: 단일 PR revert로 복구. 이 단계 배포 중 발생한 데이터 변경은 모두 append-only 행이므로 롤백해도 과거 행이 남을 뿐 손실 없음.

## Stage 2: 백엔드 — admin 엔드포인트 3개 신설

### 범위

NestJS에 admin 전용 엔드포인트 3개를 추가한다. 이 단계만으로는 cash-more-web은 여전히 Supabase 직접 호출을 유지한다 (Stage 3에서 교체).

### 신규 엔드포인트

#### (1) `DELETE /admin/every-receipt/:id`

**인증**: `x-admin-api-key` 헤더, `BATCH_API_KEY` 환경변수로 검증 (기존 `admin-cash-exchange.controller.ts` 컨벤션 재사용)

**동작:**
1. `every_receipt` 조회 (`user_id`, `status`, `point` 획득)
2. 없으면 404
3. `status === 'completed'`인 경우:
   - `point_actions` INSERT: `-every_receipt.point`, `{ every_receipt_id, reason: 'admin_delete' }`
4. `every_receipt` row DELETE

**응답**: `{ success: true }`

**대체**: cash-more-web `/app/api/admin/every_receipt/[id]/delete/route.ts`

#### (2) `PATCH /admin/every-receipt/:id/point`

**요청 body**: `{ newPoint: number }` (DTO로 validation)

**인증**: 동일

**동작:**
1. `every_receipt` 조회 (`status`, `point = oldPoint`)
2. 없으면 404
3. `every_receipt` UPDATE: `point = newPoint`, `updated_at = now()`
4. `status === 'completed'`인 경우에만:
   - `delta = newPoint - oldPoint`
   - `delta !== 0`이면 `point_actions` INSERT: `+delta`, `{ every_receipt_id, reason: 'admin_adjust', before_point: oldPoint, after_point: newPoint }`
   - `delta === 0`이면 INSERT 생략

**응답**: `{ success: true }`

**대체**: cash-more-web `/app/admin/every_receipt/serverActions/saveEveryReceiptPoint.ts`

#### (3) `POST /admin/every-receipt/re-review/complete`

**요청 body**:
```ts
{
  everyReceiptId: number;
  afterScoreData: ScoreData;
  afterPoint: number;
  afterTotalScore: number;
}
```

**인증**: 동일

**동작:**
1. `every_receipt_re_review` 조회 (`every_receipt_id` 기준) → `status === 'pending'` 확인
2. `every_receipt` 조회 → `user_id`, `point = beforePoint` 획득
3. `beforeGrade = getGradeFromPoint(beforePoint)`

**분기 A — `afterPoint <= beforePoint` (점수 유지/하락):**
- `every_receipt_re_review` UPDATE → `status='rejected'`, `reviewed_at=now()`
- `every_receipt` UPDATE → `status='completed'`, `completed_at=now()`
- `point_actions` INSERT: `+beforePoint`, `{ every_receipt_id, every_receipt_re_review_id, reason: 're_review_rejected' }`
- `UserModalService.createModal('every_receipt_re_reviewed', ...)` — before/after 동일
- `FcmService.sendRefreshMessage(userId, 'receipt_update')`

**분기 B — `afterPoint > beforePoint` (점수 상승):**
- `every_receipt_re_review` UPDATE → `status='completed'`, `after_score_data`, `reviewed_at=now()`
- `every_receipt` UPDATE → `score_data` (+total_score), `point=afterPoint`, `status='completed'`
- `point_actions` INSERT: `+afterPoint`, `{ every_receipt_id, every_receipt_re_review_id, reason: 're_review_approved' }`
- `UserModalService.createModal('every_receipt_re_reviewed', ...)` — 등급 변화 포함
- `FcmService.pushNotification(userId, "영수증 재검수 완료 💌", ...)`

**에러 처리**: 중간 실패 시 `SlackService`로 알림 (cash-more-web의 `reportBugToSlack` 역할)

**응답**: `{ success: true, message?: string }`

**대체**: cash-more-web `/app/api/every_receipt/re_review/complete/route.ts`

### 수정할 파일

1. **신규 `src/admin/admin-every-receipt.controller.ts`**
   - 위 3개 엔드포인트 정의
   - Swagger 데코레이터 (`@ApiTags('Admin - EveryReceipt')`, `@ApiHeader`, `@ApiOperation` 등)
   - `validateApiKey` 내부 메서드 (기존 admin 컨트롤러와 동일 패턴)

2. **신규 DTO**
   - `src/every-receipt/dto/admin-update-point.dto.ts` — `{ newPoint: number }`
   - `src/every-receipt/dto/admin-complete-re-review.dto.ts` — 재검수 완료 body
   - `src/every-receipt/dto/admin-delete-receipt.dto.ts` — (response DTO)

3. **`src/admin/admin.module.ts`**
   - `imports`에 `EveryReceiptModule` 추가
   - `controllers`에 `AdminEveryReceiptController` 등록

4. **`src/every-receipt/every-receipt.service.ts`**
   - 신규 메서드 3개 추가:
     - `adminDeleteReceipt(receiptId)`
     - `adminUpdatePoint(receiptId, newPoint)`
     - `adminCompleteReReview(params)`
   - 내부에서 Stage 1에서 추가된 repository 메서드 재사용
   - `adminCompleteReReview`는 `UserModalService`, `FcmService`, `SlackService` 주입 필요

5. **`src/every-receipt/every-receipt.module.ts`**
   - `imports`에 필요한 모듈 추가 (`UserModalModule`, `SlackModule` — 현재 누락된 것 확인 후 추가)
   - `exports`에 `EveryReceiptService` 이미 존재 (재확인만)

6. **`src/every-receipt/interfaces/every-receipt-repository.interface.ts`**
   - `deleteReceipt(receiptId)`: `every_receipt` row 삭제
   - `updateReceiptPoint(receiptId, newPoint)`: `every_receipt.point` UPDATE
   - `findReceiptById(receiptId)`: admin용 전체 조회 (user_id, status, point 포함)
   - `updateReReviewStatus(reReviewId, status, afterScoreData?)`: `every_receipt_re_review` UPDATE
   - `updateReceiptAfterReReview(receiptId, scoreData, point, totalScore)`: 재검수 승인 UPDATE

7. **`src/every-receipt/repositories/supabase-every-receipt.repository.ts`** & **`stub-every-receipt.repository.ts`**
   - 위 메서드 구현

8. **`src/user-modal/user-modal.service.ts`**
   - `createModal(userId, name, additionalData?)` 메서드 추가 (repository의 기존 createModal을 서비스 레이어에 노출하는 얇은 래퍼)

### 테스트

9. **`src/every-receipt/every-receipt.service.spec.ts`**
   - 3개 admin 메서드의 단위 테스트:
     - `adminDeleteReceipt`: completed 상태에서 reversal INSERT + receipt 삭제 확인 / pending 상태에서는 reversal 없음
     - `adminUpdatePoint`: completed + delta !== 0 / completed + delta === 0 / non-completed 세 가지 케이스
     - `adminCompleteReReview`: 분기 A (점수 유지/하락) / 분기 B (점수 상승) / 이미 처리된 재검수 / 존재하지 않는 재검수 / `afterPoint === beforePoint` 경계값

10. **신규 `src/admin/admin-every-receipt.controller.spec.ts`**
    - 컨트롤러 레벨 단위 테스트 (인증 실패, 파라미터 validation)

11. **`test/every-receipt.e2e.spec.ts`**
    - 3개 엔드포인트의 E2E 테스트 (실 Supabase 대상)
    - `x-admin-api-key` 헤더 검증
    - point_actions append-only 불변식 확인

### 배포 / 롤백

- 단독 배포 가능. cash-more-web은 영향 없음 (새 엔드포인트는 아직 호출되지 않음).
- 롤백: 단일 PR revert.

## Stage 3: cash-more-web — admin 경로 NestJS 호출로 교체

### 범위

cash-more-web의 admin 3개 경로에서 Supabase 직접 호출을 제거하고 NestJS 백엔드 HTTP 호출로 대체한다. 기능적으로는 Stage 2에서 만든 엔드포인트를 실사용하게 전환하는 단계다.

### 수정할 파일

1. **`cash-more-web/app/api/admin/every_receipt/[id]/delete/route.ts`**
   - Supabase 직접 호출 제거
   - 백엔드 `DELETE /admin/every-receipt/:id` 호출로 교체
   - `x-admin-api-key` 헤더는 cash-more-web env에서 읽어 전달

2. **`cash-more-web/app/admin/every_receipt/serverActions/saveEveryReceiptPoint.ts`**
   - Supabase 직접 호출 제거
   - 백엔드 `PATCH /admin/every-receipt/:id/point` 호출로 교체

3. **`cash-more-web/app/api/every_receipt/re_review/complete/route.ts`**
   - Supabase 직접 호출 + 비즈니스 로직 제거
   - 백엔드 `POST /admin/every-receipt/re-review/complete` 호출로 교체
   - UserModal 생성 / FCM / Slack 호출은 모두 백엔드로 이관됨

### 사전 준비

- cash-more-web env에 `BACKEND_URL`, `ADMIN_API_KEY` (= 백엔드의 `BATCH_API_KEY`) 추가 확인
- HTTP 클라이언트 헬퍼(이미 존재한다면 재사용)

### 검증

- 스테이징 환경에서 admin UI로 직접 테스트:
  - 영수증 삭제 → `point_actions`에 `admin_delete` 행 생성 및 `every_receipt` 삭제 확인
  - 포인트 수정 → `admin_adjust` 행 생성 및 `every_receipt.point` 갱신 확인
  - 재검수 완료 (분기 A/B) → 원장 + 재검수 상태 + 유저 알림 확인
- 기존 데이터에 대한 영향 검증: 과거에 DELETE/UPDATE로 처리된 영수증은 그대로, 새 작업만 append-only

### 배포 / 롤백

- **의존**: Stage 2 배포 완료 후
- cash-more-web 단독 배포
- 롤백: cash-more-web PR revert로 즉시 복구. Stage 2에서 추가된 백엔드 엔드포인트는 살아 있어도 무방 (호출자가 없어질 뿐)

### Stage 3 완료 후 정리

- `src/every-receipt/repositories/*` 에서 `deletePointAction` 메서드 제거
- cash-more-web `/app/admin/every_receipt/*`의 dead code 정리 (선택)

## 전체 타임라인 / 의존 관계

```
Stage 1 (백엔드 단독)
    └── 독립 배포 가능, cash-more-web 무관
Stage 2 (백엔드 단독)
    └── 독립 배포 가능, 새 API 추가만
Stage 3 (cash-more-web)
    └── Stage 2 배포 완료에 의존
    └── Stage 3 완료 후 `deletePointAction` 제거
```

## 위험 요소 및 대응

| 위험 | 대응 |
|---|---|
| Stage 3 배포 중 admin API 실패 시 admin 작업 차단 | 스테이징 충분 검증 / 즉시 revert 가능 |
| 기존 데이터 중 과거 DELETE로 처리된 영수증과 새 append-only 데이터가 공존 | 불변식은 "`status='completed'`일 때만" 성립. 과거 삭제된 행은 `status='re-review'` 상태라 영향 없음 |
| UserModal 서비스의 `createModal` 누락 | Stage 2 작업 중 `UserModalService`에 메서드 추가 |
| admin 이관 중 원장과 every_receipt.point가 일시적 불일치 | 단일 요청 내 두 쓰기는 즉시 순차 수행. 장애 시 점검 cron으로 검출 (이 계획 범위 밖) |
| `BATCH_API_KEY` 이름이 admin/batch 혼용 | 이번 계획에선 그대로 재사용. 분리는 별도 작업으로 고려 |

## 테스트 체크리스트

- [ ] Stage 1: `requestReReview` 후 point_actions에 원본 + reversal 2행 존재, SUM = 0
- [ ] Stage 1: stub repository + supabase repository 동일 동작
- [ ] Stage 2: admin 3개 엔드포인트 E2E (인증 실패 포함)
- [ ] Stage 2: `adminUpdatePoint` delta=0 경계 케이스 (행 추가 없음)
- [ ] Stage 2: `adminCompleteReReview` 분기 A/B 양쪽 모두
- [ ] Stage 2: `afterPoint === beforePoint` 경계값 (분기 A로 진입)
- [ ] Stage 2: 이미 처리된 재검수 요청 → 409/400 에러
- [ ] Stage 2: 존재하지 않는 영수증/재검수 → 404
- [ ] Stage 3: admin UI에서 실제 워크플로 수동 검증 (삭제/수정/재검수 완료)
- [ ] Stage 3: 스테이징 DB에서 append-only 불변식 확인
