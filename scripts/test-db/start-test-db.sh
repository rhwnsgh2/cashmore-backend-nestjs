#!/usr/bin/env bash
#
# Boot the test Supabase instance and apply the test-only Postgres tuning.
# Use this instead of `supabase start` for the test DB.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT/supabase-test"
supabase start

bash "$SCRIPT_DIR/tune-postgres.sh"
