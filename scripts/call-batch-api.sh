#!/bin/bash
#
# point-batch API 호출 스크립트
#
# 사용법:
#   ./scripts/call-batch-api.sh <command> [options]
#
# 명령어:
#   aggregate [baseDate]          월별 적립 포인트 집계
#   expire-preview [baseDate]     소멸 미리보기 (dry-run)
#   expire [baseDate]             소멸 실행
#   monthly [baseDate]            월간 배치 전체 실행 (집계+소멸)
#   rollback <expirationMonth>    소멸 롤백
#
# 예시:
#   ./scripts/call-batch-api.sh aggregate 2026-02-01
#   ./scripts/call-batch-api.sh expire-preview
#   ./scripts/call-batch-api.sh expire 2026-02-01
#   ./scripts/call-batch-api.sh monthly 2026-02-01
#   ./scripts/call-batch-api.sh rollback 2025-07
#
# 환경변수:
#   BATCH_API_URL   API 베이스 URL (기본: http://localhost:8000)
#   BATCH_API_KEY   배치 API 키 (필수)

set -euo pipefail

API_URL="${BATCH_API_URL:-https://api.cashmore.kr}"
API_KEY="${BATCH_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "BATCH_API_KEY 환경변수가 설정되지 않았습니다."
  echo "  export BATCH_API_KEY=your-key"
  exit 1
fi

COMMAND="${1:-}"
if [ -z "$COMMAND" ]; then
  echo "명령어를 입력해주세요: aggregate | expire-preview | expire | monthly | rollback"
  exit 1
fi

call_api() {
  local method="$1"
  local path="$2"
  local description="$3"

  echo "--- $description ---"
  echo "$method $API_URL$path"
  echo ""

  curl -s -w "\n\nHTTP Status: %{http_code}\n" \
    -X "$method" \
    -H "x-batch-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    "$API_URL$path" | jq . 2>/dev/null || cat

  echo ""
}

case "$COMMAND" in
  aggregate)
    BASE_DATE="${2:-}"
    QUERY=""
    [ -n "$BASE_DATE" ] && QUERY="?baseDate=$BASE_DATE"
    call_api POST "/point-batch/aggregate$QUERY" "월별 적립 포인트 집계${BASE_DATE:+ (기준일: $BASE_DATE)}"
    ;;

  expire-preview)
    BASE_DATE="${2:-}"
    QUERY=""
    [ -n "$BASE_DATE" ] && QUERY="?baseDate=$BASE_DATE"
    call_api POST "/point-batch/expire/preview$QUERY" "소멸 미리보기${BASE_DATE:+ (기준일: $BASE_DATE)}"
    ;;

  expire)
    BASE_DATE="${2:-}"
    QUERY=""
    [ -n "$BASE_DATE" ] && QUERY="?baseDate=$BASE_DATE"
    call_api POST "/point-batch/expire$QUERY" "소멸 실행${BASE_DATE:+ (기준일: $BASE_DATE)}"
    ;;

  monthly)
    BASE_DATE="${2:-}"
    QUERY=""
    [ -n "$BASE_DATE" ] && QUERY="?baseDate=$BASE_DATE"
    call_api POST "/point-batch/monthly$QUERY" "월간 배치 전체 실행${BASE_DATE:+ (기준일: $BASE_DATE)}"
    ;;

  rollback)
    EXPIRATION_MONTH="${2:-}"
    if [ -z "$EXPIRATION_MONTH" ]; then
      echo "소멸 기준월을 입력해주세요: ./scripts/call-batch-api.sh rollback 2025-07"
      exit 1
    fi
    call_api DELETE "/point-batch/expire/rollback?expirationMonth=$EXPIRATION_MONTH" "소멸 롤백 (기준월: $EXPIRATION_MONTH)"
    ;;

  *)
    echo "알 수 없는 명령어: $COMMAND"
    echo "사용 가능: aggregate | expire-preview | expire | monthly | rollback"
    exit 1
    ;;
esac
