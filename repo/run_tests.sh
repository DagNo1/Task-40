#!/usr/bin/env bash
set -u

TOTAL=2
PASS=0
FAIL=0

echo "=== SentinelDesk One-Click Test Runner ==="

if [ ! -x "./backend/node_modules/.bin/jest" ] || [ ! -x "./frontend/node_modules/.bin/vitest" ]; then
  echo "[preflight] Test runners not found. Installing workspace dependencies (including dev)..."
  if npm install --include=dev; then
    echo "[preflight] Dependency install complete"
  else
    echo "[preflight] Dependency install failed"
    echo "=== Final Summary ==="
    echo "total=${TOTAL} pass=${PASS} fail=${TOTAL}"
    exit 1
  fi
fi

echo "[1/2] unit_tests"
if sh ./unit_tests/run.sh; then
  PASS=$((PASS + 1))
  echo "[run_tests] PASS unit_tests"
else
  FAIL=$((FAIL + 1))
  echo "[run_tests] FAIL unit_tests"
fi

echo "[2/2] API_tests"
if sh ./API_tests/run.sh; then
  PASS=$((PASS + 1))
  echo "[run_tests] PASS API_tests"
else
  FAIL=$((FAIL + 1))
  echo "[run_tests] FAIL API_tests"
fi

echo "=== Final Summary ==="
echo "total=${TOTAL} pass=${PASS} fail=${FAIL}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0
