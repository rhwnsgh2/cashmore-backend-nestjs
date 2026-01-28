# AppLovin Data Collector

> AppLovin MAX 광고 데이터를 수집하여 BigQuery에 저장하는 Lambda 함수

## 개요

매일 자동으로 AppLovin MAX API에서 광고 수익 및 노출 데이터를 수집하여 BigQuery에 저장합니다.

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   EventBridge   │────▶│     Lambda      │────▶│    BigQuery     │
│  (매일 04:00)   │     │  (Node.js 20)   │     │    (applovin)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Secrets  │ │ AppLovin │ │CloudWatch│
              │ Manager  │ │   API    │ │   Logs   │
              └──────────┘ └──────────┘ └──────────┘
```

## 수집 데이터

### 1. Revenue Hourly (`revenue_hourly`)

**소스**: Revenue Reporting API
**수집 시점**: D-1 (어제 데이터)
**특징**: `max_placement` 포함, `fill_rate` 제외

| 컬럼 | 타입 | 설명 |
|------|------|------|
| date | DATE | 날짜 |
| hour | INT64 | 시간 (0-23) |
| platform | STRING | android / ios |
| application | STRING | 앱 이름 |
| package_name | STRING | 패키지명 |
| ad_format | STRING | INTER / BANNER / REWARD |
| network | STRING | 광고 네트워크 |
| network_placement | STRING | 네트워크 배치 ID |
| country | STRING | 국가 코드 (kr, us 등) |
| device_type | STRING | phone / tablet |
| max_ad_unit_id | STRING | MAX Ad Unit ID |
| max_placement | STRING | MAX 배치명 |
| ad_unit_waterfall_name | STRING | 워터폴 이름 |
| impressions | INT64 | 노출 수 |
| estimated_revenue | NUMERIC | 추정 수익 (USD) |
| ecpm | NUMERIC | eCPM (USD) |
| collected_at | TIMESTAMP | 수집 시각 |

### 2. Revenue Fill Rate (`revenue_hourly_fill_rate`)

**소스**: Revenue Reporting API
**수집 시점**: D-1 (어제 데이터)
**특징**: `fill_rate` 포함, `max_placement` 제외

| 컬럼 | 타입 | 설명 |
|------|------|------|
| ... | ... | (revenue_hourly와 동일, max_placement 제외) |
| attempts | INT64 | 광고 요청 시도 횟수 |
| responses | INT64 | 광고 응답 수 |
| fill_rate | NUMERIC | 채움률 (0-1) |

### 3. Impressions (`impressions`)

**소스**: User-Level Ad Revenue API
**수집 시점**: D-2 (그저께 데이터, 8시간 지연 고려)
**특징**: 개별 노출 단위 상세 데이터

| 컬럼 | 타입 | 설명 |
|------|------|------|
| impression_at | TIMESTAMP | 노출 시각 |
| ad_unit_id | STRING | Ad Unit ID |
| ad_unit_name | STRING | Ad Unit 이름 |
| waterfall | STRING | 워터폴 이름 |
| ad_format | STRING | 광고 형식 |
| placement | STRING | 배치명 |
| country | STRING | 국가 코드 |
| device_type | STRING | 디바이스 타입 |
| idfa | STRING | 광고 식별자 (GAID/IDFA) |
| idfv | STRING | 벤더 식별자 |
| user_id | STRING | 사용자 ID |
| revenue | NUMERIC | 수익 (USD) |
| network | STRING | 광고 네트워크 |
| ad_placement | STRING | 네트워크 배치 ID |
| custom_data | STRING | 커스텀 데이터 |
| platform | STRING | android / ios |
| collected_date | DATE | 수집 대상 날짜 |

## 실행 일정

| 항목 | 값 |
|------|-----|
| 실행 시간 | 매일 KST 04:00 (UTC 19:00) |
| 트리거 | EventBridge Rule |
| Lambda 함수명 | `cashmore-applovin-collector` |

## AWS 리소스

### Lambda

| 항목 | 값 |
|------|-----|
| 런타임 | Node.js 20 |
| 메모리 | 3008 MB |
| 타임아웃 | 10분 |
| 리전 | ap-northeast-2 |

### Secrets Manager

| 시크릿 | 용도 |
|--------|------|
| `cashmore/applovin` | AppLovin Report API Key |
| `cashmore/bigquery` | BigQuery 서비스 계정 인증 정보 |

### BigQuery

| 항목 | 값 |
|------|-----|
| 프로젝트 | cashmore-c2027 |
| 데이터셋 | applovin |
| 리전 | US |

## 예상 비용

| 항목 | 월 비용 |
|------|--------|
| Lambda | ~$1 |
| BigQuery Streaming Insert | ~$0.75 |
| BigQuery 저장 | ~$0.30/월 (누적) |
| **총계** | **~$2-3/월** |

## 로컬 테스트

```bash
cd data-collector

# 의존성 설치
npm install

# 환경 변수 설정
export APPLOVIN_API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id cashmore/applovin \
  --query SecretString --output text | jq -r '.apiKey')
export BQ_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id cashmore/bigquery \
  --query SecretString --output text)

# 테스트 스크립트 작성 후 실행
npx tsx test-script.ts
```

## 수동 실행

```bash
# Lambda 비동기 실행
aws lambda invoke \
  --function-name cashmore-applovin-collector \
  --invocation-type Event \
  /dev/null

# 로그 확인
aws logs tail /aws/lambda/cashmore-applovin-collector --follow
```

## 트러블슈팅

### 1. NUMERIC 정밀도 에러

```
Invalid NUMERIC value: 0.16200684931506848
```

**원인**: BigQuery NUMERIC은 소수점 9자리까지만 지원
**해결**: `ecpm`, `estimated_revenue` 값을 `.toFixed(9)`로 반올림

### 2. Streaming Buffer 에러

```
UPDATE or DELETE statement over table... would affect rows in the streaming buffer
```

**원인**: BigQuery는 최근 삽입 데이터(~90분)에 DELETE 불가
**해결**: 90분 후 재시도 또는 정상 스케줄 실행 시 자동 해결

### 3. Request Entity Too Large (413)

```
Request Entity Too Large
```

**원인**: BigQuery streaming insert 배치가 너무 큼
**해결**: 배치 크기를 5000 rows로 제한

### 4. OutOfMemory

```
Runtime.OutOfMemory
```

**원인**: Lambda 메모리 부족 (190만+ rows 처리)
**해결**: Lambda 메모리를 3008MB로 증가

## 폴더 구조

```
data-collector/
├── src/
│   ├── handlers/
│   │   └── applovin.ts      # Lambda 핸들러
│   ├── collectors/
│   │   └── applovin/
│   │       ├── client.ts    # AppLovin API 클라이언트
│   │       └── types.ts     # 타입 정의
│   └── clients/
│       └── bigquery.ts      # BigQuery 클라이언트
├── package.json
└── README.md
```

## 참고 문서

- [AppLovin API Reference](../APPLOVIN_API_REFERENCE.md)
- [Revenue Reporting API 공식 문서](https://support.axon.ai/en/max/reporting-apis/revenue-reporting-api/)
- [User-Level API 공식 문서](https://support.axon.ai/en/max/reporting-apis/user-level-ad-revenue-api/)

---

*Last Updated: 2026-01-24*
