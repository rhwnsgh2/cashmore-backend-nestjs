# Buzzvil 로그 검색 가이드

CloudWatch Logs에서 Buzzvil 관련 로그를 조회하는 방법 정리.

## 기본 정보

- **Log Group**: `/ecs/cashmore`
- **Region**: `ap-northeast-2`
- **Retention**: 2주
- **정의 위치**: `infrastructure/lib/infrastructure-stack.ts:176`

## 두 가지 조회 도구 — 언제 뭘 쓸지

| 목적 | 도구 | 이유 |
|------|------|------|
| 추세/집계 (일별 합계, 평균, 카운트) | **CloudWatch Insights** (`aws logs start-query`) | 서버 쪽 집계. 7일 스캔이 수십 초 안에 끝남 |
| 최근 1–6시간 내 특정 로그 원본 확인 | `aws logs filter-log-events` | 단순. 단 범위가 넓으면 수 분~타임아웃 |

**중요**: 1일 이상 범위의 집계는 무조건 Insights. `filter-log-events`로 7일치 getAds 뽑으려다 죽은 전례 있음 (매칭 10M+ / 스캔 65GB).

## Buzzvil 서비스가 찍는 로그 포맷

`src/buzzvil/buzzvil.service.ts` 기준.

### 1. getAds 결과 (`INFO`)
```
getAds: authId={authId}, total={N}, types={"type1":N,"type2":N,...}
```
`buzzvil.service.ts:60-62`

### 2. participate 성공 (`INFO`)
```
participate OK: authId={authId}, platform={A|I}, campaign_id={id}, ifa={ifa}
```
`buzzvil.service.ts:86-88`

### 3. participate 실패 (`ERROR`)
```
participate FAIL: authId={...}, platform={...}, campaign_id={...}, ifa={...}, status={HTTP}, resBody={...}, msg={...}, reqUrl={...}, reqHeaders={...}, reqBody={...}
```
`buzzvil.service.ts:96-100`

### 4. Postback 성공 (`INFO`)
```
Postback processed: auth_id={...}, user_id={...}, point={N}, campaign_id={...}
```
`buzzvil.service.ts:142-144`

### 5. Postback: 모르는 auth_id (`WARN`)
```
Postback for unknown auth_id: {authId}, transaction_id: {tid}
```
`buzzvil.service.ts:117-119`

### 6. Postback IP 차단 (`WARN`)
```
Blocked postback from IP: {ip}
```
`ip-whitelist.guard.ts:23`

### 7. Morgan HTTP 로그 (버즈빌 경로)
```
{IP} - - [{날짜}] "GET /buzzvil/ads?..." 200 - "-" "{UA}"
{IP} - - [{날짜}] "POST /buzzvil/participate ..." 200 ...
{IP} - - [{날짜}] "POST /buzzvil/postback ..." 200 ...
```

## Insights 쿼리 패턴 — 실행 방법

```bash
START=$(date -v-7d +%s)    # 7일 전
END=$(date +%s)

QUERY_ID=$(aws logs start-query \
  --log-group-name "/ecs/cashmore" \
  --start-time $START --end-time $END \
  --region ap-northeast-2 \
  --query-string '<쿼리>' \
  --query 'queryId' --output text)

# 폴링 — 보통 5–15초면 Complete
while :; do
  R=$(aws logs get-query-results --query-id $QUERY_ID --region ap-northeast-2 --output json)
  S=$(echo "$R" | python3 -c "import json,sys;print(json.load(sys.stdin)['status'])")
  echo "$S"
  [ "$S" = "Complete" ] && echo "$R" > /tmp/r.json && break
  [ "$S" = "Failed" ] || [ "$S" = "Cancelled" ] && break
  sleep 3
done
```

결과 파싱 예시:
```bash
python3 <<'EOF'
import json
from datetime import datetime, timezone, timedelta
kst = timezone(timedelta(hours=9))
d = json.load(open('/tmp/r.json'))
for row in d['results']:
    kv = {f['field']: f['value'] for f in row}
    print(kv)
EOF
```

## 자주 쓰는 쿼리 템플릿

### A. getAds 일별 추세 (요청 수 · 총 광고 수 · 평균)

```
fields @timestamp, @message
| filter @message like /getAds: authId=/
| parse @message "total=*," as total
| stats count() as requests, sum(total) as total_ads, avg(total) as avg_ads by bin(1d)
| sort @timestamp asc
```

→ 평소 평균 `avg_ads`가 6 내외. 1 근처로 떨어지면 버즈빌 쪽 이상 또는 레이트리밋 의심 (2026-04-02 사례).

### B. getAds 시간별 추세 (장애 시점 좁히기)

```
fields @timestamp, @message
| filter @message like /getAds: authId=/
| parse @message "total=*," as total
| stats count() as requests, avg(total) as avg_ads by bin(1h)
| sort @timestamp asc
```

### C. getAds 반환 광고 타입 분포

현재 로그는 `types={"cpc":3,"cpi":2}` 형태의 JSON이 통째로 찍혀서 Insights `parse`로 쪼개기는 어려움. 타입별 분석이 필요하면:
1. 범위를 좁혀 `filter-log-events`로 원본을 받고 Python에서 정규식 파싱, 또는
2. 서비스에 타입별 별도 로그 라인을 추가.

### D. participate 성공/실패 수 (일별)

```
fields @timestamp, @message
| filter @message like /participate (OK|FAIL):/
| parse @message "participate *:" as outcome
| stats count() by outcome, bin(1d)
| sort @timestamp asc
```

### E. participate 실패 — 상태코드별 분포

```
fields @timestamp, @message
| filter @message like /participate FAIL:/
| parse @message "status=*," as status
| stats count() by status
| sort count() desc
```

### F. Postback 처리량 및 평균 포인트 (일별)

```
fields @timestamp, @message
| filter @message like /Postback processed:/
| parse @message "point=*," as point
| stats count() as postbacks, sum(point) as total_point, avg(point) as avg_point by bin(1d)
| sort @timestamp asc
```

### G. 알 수 없는 auth_id로 온 postback

```
fields @timestamp, @message
| filter @message like /Postback for unknown auth_id/
| stats count() by bin(1d)
| sort @timestamp asc
```

### H. IP 화이트리스트 차단 (공격/오설정 탐지)

```
fields @timestamp, @message
| filter @message like /Blocked postback from IP/
| parse @message "Blocked postback from IP: *" as ip
| stats count() by ip
| sort count() desc
```

### I. Morgan HTTP — /buzzvil/* 상태코드별 (일별)

```
fields @timestamp, @message
| filter @message like /"GET \/buzzvil\// or @message like /"POST \/buzzvil\//
| parse @message '" * ' as status
| stats count() by status, bin(1d)
| sort @timestamp asc
```

## filter-log-events 단축 — 최근 원본만 필요할 때

```bash
# 최근 1시간 participate 실패 원본
aws logs filter-log-events \
  --log-group-name "/ecs/cashmore" \
  --filter-pattern '"participate FAIL"' \
  --start-time $(date -v-1H +%s000) \
  --region ap-northeast-2 \
  --limit 50 \
  --output json
```

**주의**: `--start-time`은 밀리초(`%s000`), Insights `start-query`는 초(`%s`). 실수하기 쉬움.

## 참고 — 이상 징후 판단 기준 (경험치)

| 지표 | 정상 | 이상 신호 |
|------|------|-----------|
| getAds `avg_ads` | ~6.0–6.5 | <3.0 지속 시 버즈빌 응답 이상 |
| getAds 일별 요청 수 | 1.3–1.4M | +50% 이상 급증 시 클라 재시도 폭주 의심 |
| participate FAIL 비율 | 거의 0 | 분 단위 수백 건 → 외부 API 장애 |
| Postback unknown auth_id | 소량 | 급증 시 회원 탈퇴/ID 매핑 꼬임 |
