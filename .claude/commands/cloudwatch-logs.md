CloudWatch 로그를 조회합니다.

## 설정

- 로그 그룹: `/ecs/cashmore`
- 리전: `ap-northeast-2`
- 보존 기간: 2주

## 로그 종류

1. **morgan 로그** (HTTP 요청): `combined` 포맷
   - 형식: `{IP} - - [{날짜}] "{METHOD} {PATH} HTTP/1.1" {STATUS_CODE} {SIZE} ...`
   - 예: `118.46.216.94 - - [11/Mar/2026:04:37:22 +0000] "GET /buzzvil/ads?... HTTP/1.1" 200 - "-" "okhttp/4.12.0"`

2. **NestJS 로그** (앱 로그): `[Nest]` 프리픽스
   - 형식: `[Nest] 1  - {날짜}  {LEVEL} [{Context}] {메시지}`
   - 예: `[Nest] 1  - 03/11/2026, 4:39:17 AM   ERROR [ExceptionsHandler] AxiosError: Request failed with status code 503`
   - AxiosError 등의 스택 트레이스는 **여러 로그 이벤트로 분리**됨에 주의

## filter-pattern 규칙 (AWS CloudWatch)

- 여러 term을 쓰면 AND 조건 (한 로그 이벤트에 모든 term 포함 시 매칭)
- 대소문자 구분함
- **주의**: NestJS 에러 스택 트레이스가 여러 이벤트로 쪼개지므로, `'"keyword" "500"'` 같은 복합 필터는 스택 트레이스 줄까지 매칭되어 중복 카운트될 수 있음

## 정확한 쿼리 방법

### HTTP 요청 로그 조회 (morgan)

morgan 로그를 정확히 매칭하려면 `"{METHOD} {PATH}"` 패턴을 사용:

```bash
aws logs filter-log-events \
  --log-group-name "/ecs/cashmore" \
  --filter-pattern '"POST /buzzvil/participate"' \
  --start-time $(date -v-1d +%s000) \
  --region ap-northeast-2 \
  --output json
```

상태코드 필터링은 filter-pattern 대신 **python3 후처리**로 정확하게 분류:

```bash
... | python3 -c "
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

### NestJS 앱 로그 조회

```bash
# 특정 에러 타입
--filter-pattern '"[ExceptionsHandler] AxiosError"'

# 특정 서비스 로그
--filter-pattern '"[BuzzvilService]"'
```

### 날짜 지정

**주의**: macOS `date -j -f`는 로컬 타임존(KST)을 적용하여 타임스탬프가 밀릴 수 있음. 특정 날짜는 반드시 python3으로 계산:

```bash
# 특정 날짜 (하루, UTC 기준) - python3으로 정확한 epoch 계산
--start-time $(python3 -c "from datetime import datetime; print(int(datetime(2026,3,11).timestamp()*1000))") \
--end-time $(python3 -c "from datetime import datetime; print(int(datetime(2026,3,12).timestamp()*1000))")

# 최근 N시간 (상대 시간은 date -v 사용 가능)
--start-time $(date -v-6H +%s000)

# 최근 N일
--start-time $(date -v-7d +%s000)
```

### 자주 쓰는 쿼리

| 목적 | filter-pattern |
|------|---------------|
| buzzvil ads 요청 | `'"GET /buzzvil/ads"'` |
| buzzvil participate 요청 | `'"POST /buzzvil/participate"'` |
| postback 수신 | `'"POST /buzzvil/postback"'` |
| 특정 경로 전체 | `'"/buzzvil/"'` |
| AxiosError 상세 | `'"[ExceptionsHandler] AxiosError"'` |
| Postback 처리 로그 | `'"Postback processed"'` |

### 주의사항

- `--limit` 없이 실행하면 전체 결과 반환 (대량일 수 있음)
- `nextForwardToken`이 있으면 페이지네이션 필요할 수 있음
- 시간은 UTC 기준 (KST = UTC+9), python 후처리 시 변환 필요
- 복합 필터 대신 단일 경로 패턴 + python 후처리 조합이 가장 정확

## 인자

$ARGUMENTS - 검색할 키워드, 경로, 또는 조건 (예: "buzzvil/ads 에러", "participate 3월 11일", "postback 최근 1시간")
