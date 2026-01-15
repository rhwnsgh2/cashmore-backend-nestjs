# 왜 ECS Fargate인가?

## 핵심: DAU 60k에서 Lambda보다 효율적

Lambda는 요청당 과금. DAU 6만이면 요청 수가 많아서 Lambda 비용이 급증함.

ECS Fargate는 고정 비용으로 항상 실행. 트래픽이 꾸준하면 ECS가 더 저렴.

## Lambda vs ECS 비용 비교

| | Lambda | ECS Fargate |
|---|---|---|
| **과금 방식** | 요청당 + 실행시간 | 시간당 (vCPU, 메모리) |
| **DAU 60k** | 비쌈 | 적당함 |
| **트래픽 적을 때** | 저렴 | 비쌈 (항상 켜져있음) |

## 추가 이유

- **콜드 스타트 없음** - Lambda는 첫 요청이 느림
- **NestJS 그대로 사용** - Lambda는 어댑터 필요
- **WebSocket 가능** - Lambda는 어려움
- **실행 시간 무제한** - Lambda는 15분 제한

## EC2 vs Fargate

| | EC2 | Fargate |
|---|---|---|
| **오토스케일링** | 2단계 (인스턴스 + 컨테이너) | 1단계 (컨테이너만) |
| **서버 관리** | OS 패치, Docker 데몬 직접 관리 | AWS가 전부 관리 |
| **디버깅** | SSH 접속 가능 | 로그로만 확인 |
| **비용** | 리저브드로 할인 가능, 단가 저렴 | 단가 비쌈, 세밀한 조절 가능 |
| **GPU** | 가능 | 불가능 |
| **스케일아웃 속도** | 새 인스턴스 필요시 느림 | 30초~2분 예측 가능 |

### Fargate 선택 이유

- 서버 관리하고 싶지 않음
- GPU 필요 없음 (일반 API 서버)
- 오토스케일링 단순하게 하고 싶음
- 초기 비용보다 운영 편의성 우선

## EC2로 전환하려면

infrastructure-stack.ts에서 변경 필요:

1. **Auto Scaling Group 추가**
```typescript
const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
  vpc,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
  machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
  minCapacity: 2,
  maxCapacity: 10,
});

const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
  autoScalingGroup,
});
cluster.addAsgCapacityProvider(capacityProvider);
```

2. **Task Definition 변경**
```typescript
// FargateTaskDefinition → Ec2TaskDefinition
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'CashmoreTask');
```

3. **Service 변경**
```typescript
// FargateService → Ec2Service
const service = new ecs.Ec2Service(this, 'CashmoreService', {
  cluster,
  taskDefinition,
  desiredCount: 2,
});
```

> 주의: 기존 스택 삭제 후 새로 배포 필요

## 비용 예측

### 서비스 스펙
- DAU: 60,000
- 일 API 호출: 100만+
- 태스크: 0.5 vCPU, 1GB 메모리

### 트래픽 패턴
- 평소 (18시간/일): 2 태스크
- 피크 (6시간/일): 4 태스크 (출근, 점심, 퇴근)
- 이벤트 스파이크 (월 2~3회): 8~10 태스크

### Fargate 예상 비용

| 항목 | 월 비용 |
|---|---|
| ECS Fargate | ~$50~70 |
| ALB | ~$20 |
| NAT Gateway | ~$35 |
| CloudWatch | ~$5 |
| **합계** | **~$110~130** |

### EC2로 했을 경우

| 항목 | 온디맨드 | 리저브드 |
|---|---|---|
| t3.small × 2~4 | ~$40~80 | ~$25~50 |
| ALB + NAT | ~$55 | ~$55 |
| **합계** | **~$95~135** | **~$80~105** |

### 비용 비교 결론
- Fargate vs EC2 리저브드: 월 $20~30 차이
- 서버 관리 시간 고려하면 Fargate가 합리적

## 결론

DAU 6만 서비스에서 Lambda 요청당 과금은 비효율적. ECS Fargate가 비용과 성능 모두 적합.
