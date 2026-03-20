---
name: create-module
description: "새 NestJS 모듈 생성 전용. '새 모듈 만들어줘', '새 API 모듈 추가', '새 기능 모듈 만들어줘' 등 아직 존재하지 않는 모듈을 새로 만들 때 사용. 기존 모듈에 엔드포인트나 메서드를 추가하는 건 이 스킬이 아니라 add-feature 스킬을 사용할 것."
---

# NestJS Module Creator

새 모듈을 만들 때 인터뷰 → 파일 생성 → 체크리스트 확인 순서로 진행한다. 코드 작성 패턴은 CLAUDE.md와 기존 모듈 코드를 참고할 것.

## Step 1: 인터뷰

모듈을 만들기 전에 반드시 사용자에게 다음을 확인한다. `$ARGUMENTS`에 이미 답이 포함되어 있으면 해당 항목은 건너뛴다.

1. **모듈명**: 영문 kebab-case (예: `step-rewards`, `nps-survey`)
2. **모듈 목적**: 이 모듈이 뭘 하는 건지 (한 문장)
3. **DB 사용 여부**: 테이블을 읽거나 쓰는가?
   - Yes → Repository 패턴
   - No → Service-only 패턴
4. **주요 기능/엔드포인트**: 어떤 API가 필요한지 (HTTP method + path + 설명)
5. **인증 필요 여부**: `JwtAuthGuard` 사용 여부
6. **다른 모듈 의존성**: AuthModule, FcmModule, SlackModule 등
7. **Global 여부**: 다른 모듈에서 import 없이 사용해야 하는지 (Service-only일 때만 해당)

인터뷰가 끝나면 "이렇게 만들겠습니다"라고 요약을 보여주고 확인을 받는다.

## Step 2: 파일 생성

DB 사용 여부에 따라 패턴을 선택하고, 기존 모듈 코드를 참고하여 파일을 생성한다.

- **Repository 패턴** → `src/point/`, `src/attendance/` 등 참고
- **Service-only 패턴** → `src/amplitude/`, `src/slack/` 등 참고

## Step 3: 체크리스트

모든 파일을 생성한 후 아래 체크리스트를 확인한다. 빠뜨린 항목이 있으면 추가한다.

### Repository 패턴 체크리스트

- [ ] `src/{module}/interfaces/{module}-repository.interface.ts` — 도메인 타입 + 인터페이스 + Symbol 토큰
- [ ] `src/{module}/repositories/supabase-{module}.repository.ts` — Supabase 구현체
- [ ] `src/{module}/repositories/stub-{module}.repository.ts` — Stub 구현체 (Map + clear + set* + getInserted*)
- [ ] `src/{module}/dto/*.dto.ts` — Swagger + class-validator 데코레이터
- [ ] `src/{module}/{module}.service.ts` — `@Inject(SYMBOL)` 패턴
- [ ] `src/{module}/{module}.controller.ts` — Guard + Swagger 데코레이터
- [ ] `src/{module}/{module}.module.ts` — DI 바인딩 + imports + exports
- [ ] `src/{module}/{module}.service.spec.ts` — StubRepository 사용 단위 테스트
- [ ] `test/{module}.e2e.spec.ts` — AppModule + truncateAllTables + createTestUser + supertest
- [ ] `test/helpers/{module}.helper.ts` — 테스트 데이터 생성 함수 + index.ts에 re-export
- [ ] `src/app.module.ts` — 새 모듈 import 추가

### Service-only 패턴 체크리스트

- [ ] `src/{module}/{module}.service.ts`
- [ ] `src/{module}/{module}.module.ts` — Global이면 `@Global()` 추가, exports에 Service 포함
- [ ] `src/{module}/{module}.service.spec.ts` — 단위 테스트
- [ ] `test/{module}.e2e.spec.ts` — E2E 테스트
- [ ] `src/app.module.ts` — 새 모듈 import 추가
- [ ] (필요시) `src/{module}/{module}.controller.ts`, `src/{module}/dto/*.dto.ts`

## Step 4: 테스트 실행

```bash
bun test src/{module}              # 단위 테스트
bun test test/{module}.e2e.spec.ts  # E2E 테스트
```

테스트가 통과하면 완료.
