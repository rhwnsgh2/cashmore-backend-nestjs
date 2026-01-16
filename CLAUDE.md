# Cashmore Backend NestJS - Development Guide

## 프로젝트 개요

NestJS 기반 백엔드 서버. Supabase를 데이터베이스로 사용.

## 환경 설정

### Supabase 인스턴스

| 환경 | API Port | DB Port | 폴더 |
|------|----------|---------|------|
| 개발 (local) | 54321 | 54322 | `supabase/` |
| 테스트 | 54331 | 54332 | `supabase-test/` |

### 환경 변수

- `.env` - 로컬 개발용
- `.env.test` - 테스트용

## 아키텍처 패턴

### Interface 기반 Repository 패턴

Mock 대신 Interface + 구현체 방식을 사용. 인터페이스 변경 시 모든 구현체를 업데이트해야 하므로 일관성 유지에 유리함.

```
src/{module}/
├── dto/
│   └── {action}.dto.ts                 # Request/Response DTO (Swagger 데코레이터 포함)
├── interfaces/
│   └── {name}-repository.interface.ts  # 인터페이스 정의 + Symbol 토큰
├── repositories/
│   ├── supabase-{name}.repository.ts   # 프로덕션용 (Supabase)
│   └── stub-{name}.repository.ts       # 단위 테스트용 (in-memory)
├── {module}.module.ts
├── {module}.controller.ts
└── {module}.service.ts
```

### Repository 인터페이스 예시

```typescript
// interfaces/point-repository.interface.ts
export interface IPointRepository {
  findLatestSnapshot(userId: string): Promise<PointSnapshot | null>;
  findPointActionsSince(userId: string, since: string): Promise<PointAction[]>;
  // ...
}

export const POINT_REPOSITORY = Symbol('POINT_REPOSITORY');
```

### Module에서 DI 설정

```typescript
// point.module.ts
@Module({
  providers: [
    PointService,
    { provide: POINT_REPOSITORY, useClass: SupabasePointRepository },
  ],
})
export class PointModule {}
```

### Service에서 주입

```typescript
// point.service.ts
@Injectable()
export class PointService {
  constructor(
    @Inject(POINT_REPOSITORY)
    private pointRepository: IPointRepository,
  ) {}
}
```

## 테스트 전략

### 1. 단위 테스트 (Unit Test)

- **위치**: `src/**/*.spec.ts`
- **Repository**: `StubRepository` 사용 (in-memory)
- **목적**: 비즈니스 로직 검증

```typescript
// point.service.spec.ts
const stubRepository = new StubPointRepository();
stubRepository.setPointActions(userId, [...]);

const module = await Test.createTestingModule({
  providers: [
    PointService,
    { provide: POINT_REPOSITORY, useValue: stubRepository },
  ],
}).compile();
```

### 2. E2E 테스트 (Integration Test)

- **위치**: `test/**/*.e2e.spec.ts`
- **Repository**: 실제 `SupabasePointRepository` (테스트 DB)
- **목적**: API 엔드포인트 전체 흐름 검증

```typescript
// test/point.e2e.spec.ts
const moduleFixture = await Test.createTestingModule({
  imports: [AppModule],  // 실제 모듈 사용
}).compile();
```

### 테스트 헬퍼

```
test/
├── helpers/
│   ├── index.ts           # re-export
│   ├── user.helper.ts     # createTestUser()
│   └── point.helper.ts    # createPointActions()
├── setup.ts               # truncateAllTables(), DB 연결
├── supabase-client.ts     # 테스트용 Supabase 클라이언트
└── *.e2e.spec.ts
```

#### 테스트 유저 생성

```typescript
import { createTestUser } from './helpers/user.helper';

const testUser = await createTestUser(supabase);
// testUser.id는 UUID 형식
```

#### 테스트 데이터 정리

```typescript
import { truncateAllTables } from './setup';

beforeEach(async () => {
  await truncateAllTables();  // CASCADE로 모든 테이블 정리
});

afterAll(async () => {
  await truncateAllTables();
});
```

## 명령어

```bash
# 개발 서버
bun run start:dev

# 테스트 실행
bun test                           # 전체 테스트
bun test src/point                 # 특정 모듈 단위 테스트
bun test test/point.e2e.spec.ts    # E2E 테스트

# 빌드
bun run build
```

## 새로운 API 개발 순서

1. **Module 생성**: `src/{name}/{name}.module.ts`
2. **Interface 정의**: `src/{name}/interfaces/{name}-repository.interface.ts`
3. **Repository 구현체 생성**:
   - `SupabaseRepository` (프로덕션)
   - `StubRepository` (테스트)
4. **DTO 작성**: `src/{name}/dto/*.dto.ts` (Swagger 데코레이터 포함)
5. **Service 작성**: 비즈니스 로직
6. **Controller 작성**: HTTP 엔드포인트 + Swagger 데코레이터
7. **단위 테스트**: `*.spec.ts` (StubRepository 사용)
8. **테스트 헬퍼 추가** (필요시): `test/helpers/`
9. **E2E 테스트**: `test/*.e2e.spec.ts` (실제 테스트 DB 사용)

## API 문서 (Swagger)

- **URL**: `http://localhost:8000/api-docs`
- 패키지: `@nestjs/swagger`

### Controller에 Swagger 데코레이터 추가

```typescript
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Point')
@Controller('point')
export class PointController {
  @Get('total')
  @ApiOperation({ summary: '총 포인트 조회' })
  @ApiQuery({ name: 'userId', required: true, description: '사용자 ID' })
  @ApiResponse({ status: 200, type: PointTotalResponseDto })
  async getPointTotal() { ... }
}
```

### DTO에 Swagger 데코레이터 추가

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class PointTotalResponseDto {
  @ApiProperty({ description: '총 보유 포인트', example: 15000 })
  totalPoint: number;

  @ApiProperty({ description: '소멸 예정 포인트', example: 500 })
  expiringPoints: number;
}
```

## 주의사항

- 테스트 DB의 `user_id` 컬럼은 UUID 타입 - 문자열이 아닌 실제 UUID 사용
- FK 제약 조건: `point_actions` 등은 `public.user` 테이블 참조 → 테스트 시 유저 먼저 생성
- `truncateAllTables()`는 `CASCADE` 옵션으로 FK 순서 무관하게 정리
