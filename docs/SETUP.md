# Cashmore Backend 프로젝트 설정 문서

## 프로젝트 개요

- **프레임워크**: NestJS
- **패키지 매니저**: Bun
- **배포 환경**: AWS ECS Fargate
- **인프라 관리**: AWS CDK (TypeScript)
- **CI/CD**: GitHub Actions (OIDC 인증)
- **리전**: ap-northeast-2 (서울)
- **포트**: 8000
- **예상 DAU**: 60,000

---

## 1. 프로젝트 구조

```
cashmore-backend-nestjs/
├── src/                          # NestJS 소스 코드
│   ├── main.ts                   # 애플리케이션 진입점 (포트 8000)
│   ├── app.module.ts
│   ├── config/
│   │   └── configuration.ts      # 환경변수 설정
│   └── health/
│       └── health.controller.ts  # 헬스 체크 엔드포인트
├── infrastructure/               # AWS CDK 인프라 코드 (별도 프로젝트)
│   ├── bin/
│   │   └── infrastructure.ts     # CDK 앱 진입점
│   ├── lib/
│   │   └── infrastructure-stack.ts # 인프라 스택 정의
│   ├── package.json              # CDK 전용 의존성
│   ├── tsconfig.json             # CDK 전용 TypeScript 설정
│   └── cdk.json
├── .github/
│   └── workflows/
│       ├── ci.yml                # CI 워크플로우 (테스트, 린트)
│       └── deploy.yml            # CD 워크플로우 (ECR 푸시, ECS 배포)
├── docs/
│   └── SETUP.md                  # 이 문서
├── Dockerfile                    # 멀티스테이지 Docker 빌드
├── package.json
├── tsconfig.json                 # NestJS TypeScript 설정
└── tsconfig.build.json           # NestJS 빌드 전용 설정
```

---

## 2. 중요한 설정 파일

### tsconfig.json
```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    // ... 기타 설정
  },
  "exclude": ["node_modules", "dist", "infrastructure"]  // infrastructure 제외 필수!
}
```

### tsconfig.build.json
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "infrastructure", "**/*spec.ts"]
}
```

> **주의**: `infrastructure` 폴더를 exclude하지 않으면 `nest build` 시 CDK 코드가 함께 컴파일되어 오류 발생

---

## 3. AWS 인프라 구성

### CDK로 생성되는 리소스

| 리소스 | 이름/설정 | 설명 |
|--------|-----------|------|
| VPC | CashmoreVpc | 2 AZ, NAT Gateway 1개 |
| ECR Repository | cashmore-backend | Docker 이미지 저장소 (RETAIN 정책) |
| ECS Cluster | cashmore-cluster | Fargate 클러스터 |
| ECS Service | cashmore-service | 2개 태스크로 시작 |
| Task Definition | CashmoreTask | 512 CPU, 1024 MB 메모리 |
| ALB | CashmoreAlb | 인터넷 연결, 포트 80 → 8000 |
| Auto Scaling | - | 2-10 tasks, CPU 70% 기준 |
| OIDC Provider | GithubOidcProvider | GitHub Actions 인증용 |
| IAM Role | cashmore-github-actions-role | GitHub Actions 권한 |

### 인프라 아키텍처

```
인터넷
    ↓
[ ALB (포트 80) ]
    ↓
[ ECS Service (Fargate) ]
    ├── Task 1 (포트 8000)
    └── Task 2 (포트 8000)
    ↓
[ ECR에서 이미지 풀 ]
```

---

## 4. GitHub Actions CI/CD

### CI 워크플로우 (ci.yml)

```yaml
트리거: main, develop 브랜치 push/PR
```

1. Bun 설치
2. 의존성 설치 (`bun install --frozen-lockfile`)
3. Lint 실행 (`bun run lint`)
4. 테스트 실행 (`bun run test`)
5. 빌드 (`bun run build`)

### CD 워크플로우 (deploy.yml)

```yaml
트리거: main 브랜치 push만
인증: OIDC (AWS Access Key 불필요!)
```

1. AWS 자격 증명 (OIDC role-to-assume)
2. ECR 로그인
3. Docker 이미지 빌드 및 푸시
4. ECS 서비스 강제 재배포

### OIDC 인증 방식

Access Key/Secret Key 대신 OIDC 토큰 사용:
- **장점**: 키 노출 위험 없음, 키 로테이션 불필요
- **설정**: GitHub 리포지토리와 AWS IAM Role 간 신뢰 관계

```yaml
# deploy.yml에서 사용
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::183631320364:role/cashmore-github-actions-role
    aws-region: ap-northeast-2
```

---

## 5. Docker 설정

### Dockerfile (멀티스테이지 빌드)

```dockerfile
# Build stage
FROM oven/bun:1-alpine AS builder
# 의존성 설치 및 빌드

# Production stage
FROM oven/bun:1-alpine AS production
# non-root 사용자 (nestjs:1001)
# Health check 내장
# 최종 이미지: ~80MB
```

### 로컬 Docker 테스트

```bash
# 빌드
docker build -t cashmore-backend .

# 실행
docker run -p 8000:8000 cashmore-backend

# 테스트
curl http://localhost:8000/health
```

---

## 6. 배포 가이드

### 최초 배포 (한 번만) - 중요!

최초 배포 시 **닭과 달걀 문제**가 있음:
- CDK deploy → ECS 서비스가 Docker 이미지 필요
- GitHub Actions → ECS 서비스가 이미 있어야 업데이트 가능

**해결 순서:**

```bash
# 1. AWS CLI 설치 및 설정
brew install awscli
aws configure
# - Access Key ID: [IAM에서 발급]
# - Secret Access Key: [IAM에서 발급]
# - Region: ap-northeast-2
# - Output: json

# 2. CDK Bootstrap (계정/리전당 한 번)
cd infrastructure
bun install
bun run cdk bootstrap

# 3. Docker 이미지 먼저 ECR에 푸시 (최초 1회만!)
cd ..  # 프로젝트 루트로
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 183631320364.dkr.ecr.ap-northeast-2.amazonaws.com
docker build -t cashmore-backend .
docker tag cashmore-backend:latest 183631320364.dkr.ecr.ap-northeast-2.amazonaws.com/cashmore-backend:latest
docker push 183631320364.dkr.ecr.ap-northeast-2.amazonaws.com/cashmore-backend:latest

# 4. 인프라 배포
cd infrastructure
bun run cdk deploy
# 보안 확인 프롬프트에서 'y' 입력
```

### 이후 배포 (자동)

코드를 main 브랜치에 push하면 GitHub Actions가 자동으로:
1. CI 테스트 실행
2. Docker 이미지 빌드
3. ECR에 푸시 (commit SHA 태그)
4. ECS 서비스 강제 재배포

```bash
git add .
git commit -m "feat: 새 기능 추가"
git push origin main
# → GitHub Actions가 자동 배포
```

---

## 7. 주요 엔드포인트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/` | GET | Hello World |
| `/health` | GET | 헬스 체크 (ALB, ECS, Docker 헬스체크용) |

### 배포 후 접속

```bash
# ALB DNS로 접속 (CDK 출력에서 확인)
curl http://[ALB-DNS-NAME]/health
```

---

## 8. 환경 변수

### 현재 설정된 변수

| 변수 | 값 | 설정 위치 |
|------|-----|-----------|
| PORT | 8000 | Dockerfile, ECS Task |
| NODE_ENV | production | ECS Task |

### 환경 변수 추가 방법

1. **ECS Task Definition** (infrastructure-stack.ts):
```typescript
container.addContainer('CashmoreContainer', {
  environment: {
    NODE_ENV: 'production',
    PORT: '8000',
    NEW_VAR: 'value',  // 여기에 추가
  },
});
```

2. **시크릿** (AWS Secrets Manager 사용 권장):
```typescript
secrets: {
  DB_PASSWORD: ecs.Secret.fromSecretsManager(secret, 'password'),
},
```

---

## 9. 로컬 개발

```bash
# 의존성 설치
bun install

# 개발 서버 실행 (hot reload)
bun run start:dev

# 빌드
bun run build

# 프로덕션 실행
bun run start:prod

# 테스트
bun run test

# Lint
bun run lint
```

---

## 10. 트러블슈팅

### 문제 1: nest build 시 infrastructure 관련 오류

**증상**: `Cannot find module` 또는 CDK 관련 타입 오류

**원인**: tsconfig.build.json에서 infrastructure 폴더가 제외되지 않음

**해결**:
```json
// tsconfig.build.json
{
  "exclude": ["node_modules", "test", "dist", "infrastructure", "**/*spec.ts"]
}
```

### 문제 2: CDK deploy 시 ECR Repository already exists

**증상**: `Resource of type 'AWS::ECR::Repository' already exists`

**원인**: ECR 레포지토리는 RETAIN 정책으로 스택 삭제 시에도 유지됨

**해결**: infrastructure-stack.ts에서 기존 레포지토리 import:
```typescript
// 새로 생성 대신
const repository = ecr.Repository.fromRepositoryName(
  this,
  'CashmoreRepo',
  'cashmore-backend',
);
```

### 문제 3: ECS 서비스가 시작되지 않음

**증상**: ECS 태스크가 계속 PENDING 또는 STOPPED

**확인 방법**:
```bash
# 서비스 이벤트 확인
aws ecs describe-services --cluster cashmore-cluster --services cashmore-service --query 'services[0].events[0:5]'

# 태스크 로그 확인 (CloudWatch)
aws logs tail /ecs/cashmore --follow
```

**일반적인 원인**:
- ECR에 이미지가 없음
- 헬스 체크 실패 (/health 엔드포인트 확인)
- 메모리/CPU 부족

### 문제 4: GitHub Actions 배포 실패

**확인 사항**:
1. OIDC Provider가 AWS에 생성되었는지 확인
2. IAM Role의 신뢰 정책에 GitHub 리포지토리가 포함되었는지 확인
3. GitHub 리포지토리 이름이 정확한지 확인 (`rhwnsgh2/cashmore-backend-nestjs`)

---

## 11. 유용한 명령어

### AWS CLI

```bash
# ECR 이미지 목록
aws ecr describe-images --repository-name cashmore-backend

# ECS 서비스 상태
aws ecs describe-services --cluster cashmore-cluster --services cashmore-service

# ECS 태스크 목록
aws ecs list-tasks --cluster cashmore-cluster

# CloudFormation 스택 상태
aws cloudformation describe-stacks --stack-name CashmoreBackendStack

# 로그 확인
aws logs tail /ecs/cashmore --follow
```

### CDK

```bash
cd infrastructure

# 변경 사항 미리보기
bun run cdk diff

# 배포
bun run cdk deploy

# 스택 삭제 (주의!)
bun run cdk destroy
```

---

## 12. 참고 정보

| 항목 | 값 |
|------|-----|
| GitHub Repository | https://github.com/rhwnsgh2/cashmore-backend-nestjs |
| AWS Account ID | 183631320364 |
| AWS Region | ap-northeast-2 (서울) |
| OIDC Role ARN | arn:aws:iam::183631320364:role/cashmore-github-actions-role |
| ECR Repository | 183631320364.dkr.ecr.ap-northeast-2.amazonaws.com/cashmore-backend |
| ECS Cluster | cashmore-cluster |
| ECS Service | cashmore-service |

---

## 13. 비용 예상 (월간)

| 서비스 | 예상 비용 | 비고 |
|--------|-----------|------|
| ECS Fargate | ~$30-50 | 2개 태스크 (512 CPU, 1GB) |
| ALB | ~$20 | 시간당 + LCU |
| NAT Gateway | ~$35 | 시간당 + 데이터 전송 |
| ECR | ~$1 | 이미지 저장 |
| CloudWatch Logs | ~$5 | 로그 저장 |
| **총계** | **~$90-110** | |

---

## 다음 단계

- [x] CDK Bootstrap 완료
- [x] ECR에 Docker 이미지 푸시
- [x] CDK deploy로 인프라 배포
- [ ] ALB DNS로 서비스 접속 확인
- [ ] Slack 배포 알림 설정
- [ ] Supabase 데이터베이스 연동
- [ ] 비즈니스 로직 개발
