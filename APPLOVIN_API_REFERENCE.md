# AppLovin MAX API Reference

> AppLovin MAX 광고 수익 데이터를 조회하기 위한 API 레퍼런스 문서

## 목차

1. [Revenue Reporting API](#1-revenue-reporting-api)
2. [User-Level Ad Revenue API](#2-user-level-ad-revenue-api)
3. [두 API 비교](#3-두-api-비교)

---

## 1. Revenue Reporting API

집계된 광고 수익 데이터를 조회하는 API. 일별/시간별 트렌드 분석에 적합.

### 엔드포인트

```
GET https://r.applovin.com/maxReport
```

### 필수 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|---------|------|------|------|
| `api_key` | string | Report Key (대시보드 Account 섹션에서 확인) | `Hyfi8Mkct…WiWP466a1VBL7eUfUlD9JBh` |
| `columns` | string | 요청할 컬럼 (쉼표 구분) | `day,application,ecpm` |
| `start` | string | 시작일 (YYYY-MM-DD, inclusive) | `2025-01-01` |
| `end` | string | 종료일 (YYYY-MM-DD, exclusive) | `2025-01-24` |
| `format` | string | 응답 형식 | `csv` 또는 `json` |

### 선택 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|---------|------|------|------|
| `filter_«column»` | string | 특정 컬럼 값으로 필터링 | `filter_country=kr` |
| `limit` | number | 반환할 결과 수 제한 | `1000` |
| `offset` | number | 페이지네이션 offset | `0` |
| `sort_«column»` | string | 정렬 기준 | `sort_impressions=DESC` |
| `not_zero` | number | 0값 제외 (1 설정 시) | `1` |

### 사용 가능한 Columns

#### 시간/날짜

| Column | 타입 | 설명 | 제한사항 |
|--------|------|------|----------|
| `day` | string | 날짜 (YYYY-MM-DD) | - |
| `hour` | string | 시간 (HH:00 형식) | 최근 30일만 가능 |

#### 애플리케이션 정보

| Column | 타입 | 설명 |
|--------|------|------|
| `application` | string | 앱 이름 |
| `package_name` | string | 패키지명 (Android) / 번들 ID (iOS) |
| `store_id` | string | iTunes 숫자 ID 또는 패키지명 |
| `platform` | string | 플랫폼 (`android`, `fireos`, `ios`) |

#### 광고 관련

| Column | 타입 | 설명 |
|--------|------|------|
| `ad_format` | string | 광고 형식 (`INTER`, `BANNER`, `REWARD`) |
| `ad_unit_waterfall_name` | string | 광고 단위 워터폴 이름 |
| `max_ad_unit_id` | string | MAX Ad Unit ID |
| `max_ad_unit_test` | string | A/B 테스트 그룹명 |
| `max_placement` | string | MAX 중개 배치명 |
| `network` | string | 광고 네트워크 이름 |
| `network_placement` | string | 외부 네트워크 배치 |
| `custom_network_name` | string | 커스텀 네트워크 이름 |

#### 성과 지표

| Column | 타입 | 설명 | 제한사항 |
|--------|------|------|----------|
| `impressions` | number | 노출 수 | - |
| `requests` | number | 광고 요청 수 | `network`, `network_placement`, `max_placement`와 동시 사용 불가 |
| `attempts` | number | 네트워크 시도 횟수 | `network` 또는 `network_placement` 필수 |
| `responses` | number | 네트워크 응답 수 | `network` 또는 `network_placement` 필수 |
| `fill_rate` | number | 응답/시도 비율 (%) | `network` 또는 `network_placement` 필수, `max_placement`와 사용 불가 |
| `ecpm` | number | 추정 eCPM (USD) | - |
| `estimated_revenue` | number | 추정 수익 (USD) | - |

#### 사용자 정보

| Column | 타입 | 설명 |
|--------|------|------|
| `country` | string | 2자리 ISO 국가 코드 (예: `kr`, `us`, `jp`) |
| `device_type` | string | 디바이스 타입 (`phone`, `tablet`, `other`) |
| `has_idfa` | number | 광고 ID 보유 여부 (`0` 또는 `1`) |

### 응답 형식

#### JSON 응답

```json
{
  "code": 200,
  "count": 2,
  "results": [
    {
      "day": "2025-01-22",
      "hour": "00:00",
      "application": "Cash More",
      "impressions": "987654",
      "estimated_revenue": "1234.56",
      "ecpm": "1.25"
    },
    {
      "day": "2025-01-22",
      "hour": "01:00",
      "application": "Cash More",
      "impressions": "819127",
      "estimated_revenue": "1023.89",
      "ecpm": "1.25"
    }
  ]
}
```

#### CSV 응답

```csv
day,hour,application,impressions,estimated_revenue,ecpm
2025-01-22,00:00,"Cash More",987654,1234.56,1.25
2025-01-22,01:00,"Cash More",819127,1023.89,1.25
```

### 요청 예시

```bash
# 기본 요청
curl "https://r.applovin.com/maxReport?api_key=YOUR_KEY&columns=day,application,ecpm,estimated_revenue&start=2025-01-01&end=2025-01-24&format=json"

# 필터링 + 정렬
curl "https://r.applovin.com/maxReport?api_key=YOUR_KEY&columns=day,country,impressions,estimated_revenue&start=2025-01-01&end=2025-01-24&format=json&filter_country=kr&sort_estimated_revenue=DESC"

# 시간별 데이터
curl "https://r.applovin.com/maxReport?api_key=YOUR_KEY&columns=day,hour,max_ad_unit_id,impressions,estimated_revenue,ecpm&start=2025-01-20&end=2025-01-24&format=json"
```

### 제한사항

| 항목 | 제한 |
|-----|------|
| 요청 범위 | 최대 45일 |
| 시간별 데이터 (`hour`) | 최근 30일만 가능 |
| 데이터 지연 | 최근 1-2시간 데이터는 불완전할 수 있음 |

### 컬럼 호환성 주의사항

```
fill_rate, attempts, responses
  └─ network 또는 network_placement 컬럼 필수
  └─ max_placement와 함께 사용 불가

requests
  └─ network, network_placement, max_placement와 동시 사용 불가
```

---

## 2. User-Level Ad Revenue API

사용자별/노출별 상세 광고 수익 데이터를 조회하는 API. 개별 사용자 추적 및 MMP 연동에 적합.

### 엔드포인트

```
GET https://r.applovin.com/max/userAdRevenueReport
```

### 파라미터

| 파라미터 | 필수 | 타입 | 설명 | 예시 |
|---------|:----:|------|------|------|
| `api_key` | ✅ | string | Report Key | `tgCe3d7SFRU0S…` |
| `date` | ✅ | string | 보고서 날짜 (YYYY-MM-DD, 단일 날짜만) | `2025-01-22` |
| `platform` | ✅ | string | 플랫폼 | `android`, `ios`, `fireos` |
| `application` | ⚡ | string | 패키지명/번들 ID | `com.bridgeworks.cashmore` |
| `store_id` | ⚡ | string | iTunes ID 또는 패키지명 | `1207472156` |
| `aggregated` | ❌ | boolean | 집계 여부 (기본: `true`) | `true` 또는 `false` |

> ⚡ `application`과 `store_id`는 **둘 중 하나만** 사용 가능

### 응답 형식

API는 JSON으로 CSV 파일 URL을 반환합니다.

```json
{
  "status": 200,
  "url": "https://applovin-externalreports.s3.amazonaws.com/...",
  "ad_revenue_report_url": "https://applovin-externalreports.s3.amazonaws.com/...",
  "fb_estimated_revenue_url": "https://applovin-externalreports.s3.amazonaws.com/..."
}
```

| 필드 | 설명 |
|-----|------|
| `url` | 기본 CSV (Meta 입찰 추정 제외) |
| `ad_revenue_report_url` | 전체 CSV (Meta 추정 포함) |
| `fb_estimated_revenue_url` | Meta Audience Network 데이터만 (집계 모드만) |

### 사용 가능한 Columns

#### Aggregated = true (사용자별 집계)

| Column | 타입 | 설명 |
|--------|------|------|
| `Ad Unit ID` | string | MAX Ad Unit ID |
| `Placement` | string | 광고 배치 이름 |
| `IDFA` | string | 광고 식별자 (iOS IDFA / Android GAID) |
| `IDFV` | string | 벤더 식별자 |
| `User Id` | string | 내부 사용자 ID (SDK 설정 시) |
| `Impressions` | number | 노출 수 |
| `Revenue` | number | 수익 (USD, 소수점 6자리) |

#### Aggregated = false (노출별 상세)

위 필드에 추가:

| Column | 타입 | 설명 |
|--------|------|------|
| `Date` | string | 노출 시간 (타임스탬프) |
| `Ad Unit Name` | string | Ad Unit 이름 |
| `Waterfall` | string | 워터폴 이름 |
| `Ad Format` | string | 광고 형식 (`INTER`, `BANNER`, `REWARD`) |
| `Country` | string | 국가 코드 |
| `Device Type` | string | 디바이스 타입 (`PHONE`, `TABLET`) |
| `Custom Data` | string | SDK에서 설정한 커스텀 데이터 |
| `Network` | string | 광고 네트워크 (`ad_revenue_report_url`에서만) |
| `Ad Placement` | string | 외부 네트워크 배치 ID |

### CSV 데이터 예시

#### 집계 데이터 (aggregated=true)

```csv
Ad Unit ID,Placement,IDFA,IDFV,User Id,Impressions,Revenue
da39a3ee5e6b4b0,home_screen,04034992-E5AA-4BA1-890C-5075B2504050,4F2A07BC-315B-11E9-B210-D663BD873D93,user_20349,27,5.000025
da39a3ee5e6b4b0,level_end,12309422-331C-41A3-9BF5-2D7D1C04A4E0,4F2A0A6E-315B-11E9-B210-AD023491FF20,,11,0.006100
```

#### 비집계 데이터 (aggregated=false)

```csv
Date,Ad Unit ID,Ad Unit Name,Waterfall,Ad Format,Placement,Country,Device Type,IDFA,IDFV,User ID,Revenue,Ad Placement
2025-01-22 15:53:07.39,97f7d2048121fe62,interstitial-main,Default Waterfall,INTER,home-screen,kr,PHONE,34d5d192-4d67-4382-a730-6828a5f769a2,,user_12345,0.000079,16427992
```

### 요청 예시

```bash
# 집계 데이터 (Android)
curl "https://r.applovin.com/max/userAdRevenueReport?api_key=YOUR_KEY&date=2025-01-22&platform=android&application=com.bridgeworks.cashmore&aggregated=true"

# 비집계 데이터 (iOS)
curl "https://r.applovin.com/max/userAdRevenueReport?api_key=YOUR_KEY&date=2025-01-22&platform=ios&store_id=1207472156&aggregated=false"
```

### 제한사항

| 항목 | 제한 |
|-----|------|
| 데이터 가용 시점 | UTC 자정 후 8시간 뒤 (예: 01/22 데이터 → 01/23 08:00 UTC 이후) |
| 요청 범위 | 45일 이내 |
| 날짜 조회 | 하루 단위만 (범위 지정 불가) |
| User ID 최대 크기 | 8,192자 |
| Custom Data 권장 크기 | 8,192자 이하 |

### 주의사항

- `Placement`와 `User Id`는 **광고 로드 전**에 SDK에서 설정해야 데이터에 포함됨
- 설정하지 않으면 해당 필드가 비어있음

---

## 3. 두 API 비교

| 항목 | Revenue Reporting API | User-Level API |
|-----|----------------------|----------------|
| **용도** | 대시보드, 트렌드 분석 | 사용자 추적, MMP 연동 |
| **세분성** | 집계 데이터 (일/시간별) | 사용자별/노출별 상세 |
| **날짜 범위** | 시작~종료 범위 지정 | 하루 단위만 |
| **데이터 지연** | 1-2시간 | 8시간 |
| **응답 형식** | JSON/CSV 직접 반환 | JSON (CSV URL 제공) |
| **고유 필드** | `requests`, `fill_rate`, `attempts`, `responses` | `IDFA`, `IDFV`, `User Id`, `Custom Data` |
| **필터링** | 모든 컬럼에 필터 가능 | 플랫폼/앱만 필터 |
| **정렬** | 가능 | 불가 |

### 어떤 API를 사용해야 할까?

| 상황 | 권장 API |
|-----|---------|
| 일별/시간별 매출 트렌드 분석 | Revenue Reporting API |
| 국가별/네트워크별 성과 비교 | Revenue Reporting API |
| 광고 요청률, Fill Rate 분석 | Revenue Reporting API |
| 개별 사용자 광고 수익 추적 | User-Level API |
| MMP (Adjust, AppsFlyer 등) 연동 | User-Level API |
| 사용자별 LTV 분석 | User-Level API |

---

## 참고 링크

- [Revenue Reporting API 공식 문서](https://support.axon.ai/en/max/reporting-apis/revenue-reporting-api/)
- [User-Level Ad Revenue API 공식 문서](https://support.axon.ai/en/max/reporting-apis/user-level-ad-revenue-api/)

---

*Last Updated: 2026-01-23*
