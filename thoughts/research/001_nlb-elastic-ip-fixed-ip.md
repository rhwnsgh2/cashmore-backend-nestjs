# Dev Research: NLB + Elastic IP로 ECS Fargate 고정 IP 구성

*2026-03-16 | Sources: 15+개 | Framework: NestJS + AWS CDK*

## Executive Summary

현재 프로젝트는 ALB(internet-facing) → ECS Fargate 구성으로 `api.cashmore.kr` 도메인을 사용 중이며, 고정 IP가 없다. 외부 업체 IP 화이트리스트를 위해 NLB + Elastic IP를 ALB 앞에 배치하는 패턴이 가장 적합하다. 이미 CDK 코드가 있으므로 기존 infrastructure-stack.ts에 NLB + EIP 리소스를 추가하면 된다.

---

## Part 1: 기술 원리

### 왜 NLB가 필요한가?

| 로드밸런서 | Elastic IP 할당 | 고정 IP |
|-----------|----------------|---------|
| ALB | 불가능 | 동적 IP (변경됨) |
| NLB | AZ당 1개 가능 | 고정 IP 지원 |

ALB는 Layer 7 로드밸런서로 IP가 동적이다. NLB는 Layer 4 로드밸런서로 AZ당 Elastic IP를 직접 붙일 수 있다.

### 아키텍처: NLB → ALB → Fargate

```
외부 업체 (IP 화이트리스트)
    │
    ▼
┌─────────────────────────────┐
│  NLB (Public Subnet)        │  ← Elastic IP 할당 (AZ당 1개)
│  - TCP Listener (443)       │     업체에 이 IP를 알려줌
└─────────────┬───────────────┘
              │  ALB-type Target Group
              ▼
┌─────────────────────────────┐
│  ALB (Internal로 변경)       │  ← TLS 종료 (ACM 인증서)
│  - HTTPS Listener (443)     │     경로 기반 라우팅 유지
└─────────────┬───────────────┘
              │  IP-type Target Group
              ▼
┌─────────────────────────────┐
│  ECS Fargate Tasks          │
│  - awsvpc network mode      │
└─────────────────────────────┘
```

### 핵심 동작 원리

1. NLB는 TCP 패스스루만 수행 — ALB 타겟 시 TLS 리스너 사용 불가, 반드시 TCP로 설정
2. TLS 종료는 ALB에서 — ACM 인증서는 기존처럼 ALB에 연결
3. ALB-type Target Group (2021년 9월 출시) — NLB가 ALB를 직접 타겟으로 지정 가능
4. 보안그룹 체인 — NLB(sg-nlb) → ALB(sg-alb) → Fargate(sg-fargate)로 인바운드 제한

### SSL/TLS 처리 흐름

| 구간 | 프로토콜 | 설명 |
|------|----------|------|
| Client → NLB | TCP 443 | NLB는 TCP 패스스루 (복호화 안 함) |
| NLB → ALB | TCP 443 | 암호화된 트래픽 그대로 전달 |
| ALB | HTTPS 443 | 여기서 TLS 종료 (ACM 인증서) |
| ALB → Fargate | HTTP 8000 | 내부 통신은 평문 |

### 주의사항

- NLB 생성 시 보안그룹을 반드시 연결 (생성 후 추가 불가)
- NLB 헬스체크는 분산 합의 메커니즘 사용 → 설정 간격보다 실제 요청이 더 많을 수 있음
- 기존 ALB를 Internal로 변경해야 할 수 있음 (현재 internet-facing)
- HTTP → HTTPS 리다이렉트는 ALB 레벨에서 유지

---

## Part 2: 구현 방법

### 현재 코드베이스 현황

기존 CDK 코드: `infrastructure/lib/infrastructure-stack.ts`

현재 구성:
- VPC: 2 AZ, NAT Gateway 1개
- ALB: internet-facing, HTTPS(443) + HTTP→HTTPS 리다이렉트
- ACM: `api.cashmore.kr`
- ECS Fargate: CPU 1024, Memory 2048, 서비스 2~10개 태스크
- 리전: `ap-northeast-2` (서울)

### CDK 코드로 추가할 리소스 (예시)

```typescript
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

// 1. Elastic IP 할당 (AZ 2개)
const eip1 = new ec2.CfnEIP(this, 'Eip1');
const eip2 = new ec2.CfnEIP(this, 'Eip2');

// 2. NLB 생성 + EIP 매핑
const nlb = new elbv2.NetworkLoadBalancer(this, 'Nlb', {
  vpc,
  internetFacing: true,
  crossZoneEnabled: true,
  subnetMappings: [
    {
      subnet: vpc.publicSubnets[0],
      allocationId: eip1.attrAllocationId,
    },
    {
      subnet: vpc.publicSubnets[1],
      allocationId: eip2.attrAllocationId,
    },
  ],
});

// 3. NLB TCP Listener → ALB Target
const listener = nlb.addListener('TcpListener', {
  port: 443,
  protocol: elbv2.Protocol.TCP,  // TCP! (TLS 아님)
});

listener.addTargets('AlbTarget', {
  targets: [new targets.AlbListenerTarget(alb.listeners[0])],
  port: 443,
  healthCheck: {
    enabled: true,
    protocol: elbv2.Protocol.HTTP,
    path: '/health',
    interval: cdk.Duration.seconds(30),
  },
});

// 4. Output
new cdk.CfnOutput(this, 'StaticIp1', { value: eip1.ref });
new cdk.CfnOutput(this, 'StaticIp2', { value: eip2.ref });
```

### 보안그룹 설정

```
NLB (sg-nlb):     Inbound 0.0.0.0/0 → TCP 443
ALB (sg-alb):     Inbound sg-nlb → TCP 443
Fargate (sg-ecs): Inbound sg-alb → TCP 8000
```

---

## 비용 비교

| 항목 | NLB + Elastic IP | Global Accelerator (대안) |
|------|-------------------|--------------------------|
| 기본 비용 | NLB ~$16/월 | ~$18/월 |
| 고정 IP | EIP 2개 ~$7.2/월 | 포함 (2개) |
| 트래픽 100GB | ~$0.60 | ~$4~6 (DT-Premium) |
| 월 합계 | ~$24/월 | ~$24~30/월 |
| 설정 복잡도 | 중간 (CDK 코드 추가) | 낮음 |
| IP 직접 지정 | 가능 | 불가 (AWS 자동 할당) |

### 추천: NLB + Elastic IP

- 단일 리전(서울)이고, 특정 고정 IP를 업체에 전달해야 하는 사용 사례에 적합
- 이미 CDK 코드가 있으므로 리소스 추가만 하면 됨
- Global Accelerator 대비 트래픽 비용이 저렴

---

## Sources

1. [AWS NLB 공식 문서](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/network-load-balancers.html)
2. [ALB-type Target Group for NLB](https://aws.amazon.com/blogs/networking-and-content-delivery/application-load-balancer-type-target-group-for-network-load-balancer/)
3. [Containers on AWS - NLB Ingress Pattern](https://containersonaws.com/pattern/nlb-ingress-alb-load-balancer-fargate-service-cdk/)
4. [AWS ECS NLB 문서](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/nlb.html)
5. [AWS ELB Pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
6. [ALB vs NLB 비교 (Cloudcraft)](https://blog.cloudcraft.co/alb-vs-nlb-which-aws-load-balancer-fits-your-needs/)
7. [AWS Global Accelerator FAQ](https://aws.amazon.com/global-accelerator/faqs/)
8. [AWS Public IPv4 Address Charge](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/)
9. [AWS NLB Security Groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-security-groups.html)
10. [AWS re:Post - ECS Fargate Static IP](https://repost.aws/knowledge-center/ecs-fargate-static-elastic-ip-address)

## 조사 한계

- 서울 리전 정확한 NLB 시간당 단가는 AWS Pricing Calculator에서 직접 확인 필요
- NLB + ALB 이중 사용 시 데이터 전송 이중 과금 여부 미확인
- 기존 ALB를 internet-facing → internal로 변경 시 다운타임 발생 가능성 추가 확인 필요
