서버 로그를 조회하고 분석합니다. 프로덕션 서버의 에러, API 요청 로그, 배포 후 상태 확인, 장애 조사 등에 사용합니다. 사용자가 "로그 확인해줘", "서버 에러 있어?", "배포 후 괜찮아?", "500 에러 확인", "API 응답 상태", "최근 에러", "장애 원인 파악" 같은 요청을 하면 이 스킬을 사용하세요. 특정 API 경로나 에러 타입을 언급하지 않더라도, 서버 상태나 운영 이슈에 대한 질문이면 이 스킬을 트리거하세요.

## 환경

- **로그 그룹**: `/ecs/cashmore`
- **리전**: `ap-northeast-2`
- **보존 기간**: 2주
- **도구**: AWS CLI (`aws logs filter-log-events`)

## 로그 포맷

### 1. Morgan 로그 (HTTP 요청)

`combined` 포맷. API 요청/응답 확인에 사용.

```
{IP} - - [{날짜}] "{METHOD} {PATH} HTTP/1.1" {STATUS_CODE} {SIZE} "{REFERER}" "{USER_AGENT}"
```

예시:
```
118.46.216.94 - - [11/Mar/2026:04:37:22 +0000] "GET /buzzvil/ads?ifa=xxx HTTP/1.1" 200 - "-" "okhttp/4.12.0"
```

### 2. NestJS 로그 (앱 로그)

`[Nest]` 프리픽스. 앱 에러, 서비스 로직 확인에 사용.

```
[Nest] 1  - {날짜}  {LEVEL} [{Context}] {메시지}
```

예시:
```
[Nest] 1  - 03/11/2026, 4:39:17 AM   ERROR [ExceptionsHandler] AxiosError: Request failed with status code 503
```

**주의**: 에러 스택 트레이스는 여러 로그 이벤트로 분리됨.

## 사용자 요청 → AWS CLI 변환 가이드

사용자의 자연어 요청을 아래 패턴에 따라 AWS CLI 명령으로 변환한다.

### Step 1: filter-pattern 결정

| 사용자 요청 | filter-pattern |
|-------------|---------------|
| "에러 확인해줘", "500 에러" | `'"POST \|GET "' ` (morgan 로그 전체 → python 후처리로 상태코드 필터) |
| "buzzvil ads 로그" | `'"GET /buzzvil/ads"'` |
| "participate 요청" | `'"POST /buzzvil/participate"'` |
| "postback 로그" | `'"POST /buzzvil/postback"'` |
| "AxiosError", "외부 API 에러" | `'"[ExceptionsHandler] AxiosError"'` |
| "특정 서비스 로그" (예: Buzzvil) | `'"[BuzzvilService]"'` |
| "배포 후 상태 확인" | filter-pattern 없이 최근 로그 전체 조회 후 에러 비율 분석 |
| "Postback 처리 결과" | `'"Postback processed"'` |
| 특정 경로 전체 | `'"/{경로}/"'` |

### Step 2: 시간 범위 결정

```bash
# 최근 N시간
--start-time $(date -v-{N}H +%s000)

# 최근 N일
--start-time $(date -v-{N}d +%s000)

# 특정 날짜 (KST 기준) — 반드시 python3 사용 (macOS date 타임존 이슈 방지)
--start-time $(python3 -c "from datetime import datetime, timezone, timedelta; kst=timezone(timedelta(hours=9)); print(int(datetime(2026,3,11,tzinfo=kst).timestamp()*1000))") \
--end-time $(python3 -c "from datetime import datetime, timezone, timedelta; kst=timezone(timedelta(hours=9)); print(int(datetime(2026,3,12,tzinfo=kst).timestamp()*1000))")
```

사용자가 시간을 명시하지 않으면 **최근 1시간**을 기본값으로 사용.

### Step 3: 명령 조립 및 실행

```bash
aws logs filter-log-events \
  --log-group-name "/ecs/cashmore" \
  --filter-pattern '{위에서 결정한 패턴}' \
  --start-time {위에서 결정한 시간} \
  --region ap-northeast-2 \
  --output json
```

**주의사항**:
- `--limit` 없이 실행하면 대량 결과 반환 가능. 먼저 `--limit 50`으로 시작해서 규모 파악
- `nextToken`이 응답에 있으면 더 많은 결과가 있다는 의미
- 대소문자 구분됨

### Step 4: 결과 분석 (python3 후처리)

상태코드별/시간대별 분석이 필요하면 결과를 python3로 파이프:

```bash
aws logs filter-log-events \
  --log-group-name "/ecs/cashmore" \
  --filter-pattern '"GET /buzzvil/ads"' \
  --start-time $(date -v-6H +%s000) \
  --region ap-northeast-2 \
  --output json \
| python3 -c "
import json, sys, re
from collections import defaultdict
from datetime import datetime, timezone, timedelta

data = json.load(sys.stdin)
events = data.get('events', [])
kst = timezone(timedelta(hours=9))

codes = defaultdict(int)
by_hour = defaultdict(int)
timestamps = []

for e in events:
    m = re.search(r'\" (\d{3}) ', e['message'])
    if m:
        codes[m.group(1)] += 1
    dt = datetime.fromtimestamp(e['timestamp']/1000, tz=kst)
    by_hour[dt.strftime('%m/%d %H시')] += 1
    timestamps.append(e['timestamp'])

print(f'총 {len(events)}건')
print('상태코드별:', dict(codes))
print()
print('시간대별:')
for h in sorted(by_hour.keys()):
    print(f'  {h}: {by_hour[h]}건')

if timestamps:
    first = datetime.fromtimestamp(min(timestamps)/1000, tz=kst)
    last = datetime.fromtimestamp(max(timestamps)/1000, tz=kst)
    print(f'\n첫 로그 (KST): {first.strftime(\"%Y-%m-%d %H:%M:%S\")}')
    print(f'마지막 로그 (KST): {last.strftime(\"%Y-%m-%d %H:%M:%S\")}')
"
```

### 에러 조사 시 접근 방법

"에러 확인해줘" 같은 포괄적 요청에는 다음 순서로 진행:

1. **NestJS ERROR 로그 먼저 확인**: `--filter-pattern '"ERROR"' --limit 20`
2. **에러가 있으면 관련 HTTP 요청 상태코드 확인**: 해당 경로의 morgan 로그 조회
3. **시간대별 에러 분포 파악**: python3 후처리로 추세 분석
4. **결과를 KST 기준으로 요약 보고**

## filter-pattern 규칙 (AWS CloudWatch)

- 여러 term을 쓰면 AND 조건 (한 로그 이벤트에 모든 term 포함 시 매칭)
- 대소문자 구분함
- NestJS 에러 스택 트레이스가 여러 이벤트로 쪼개지므로, 복합 필터 사용 시 중복 매칭 주의
- 복합 필터보다 **단일 패턴 + python3 후처리** 조합이 더 정확

## 인자

$ARGUMENTS - 검색할 키워드, 경로, 또는 조건 (예: "buzzvil/ads 에러", "participate 3월 11일", "postback 최근 1시간", "배포 후 상태 확인", "최근 500 에러")
