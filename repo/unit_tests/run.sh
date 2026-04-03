#!/usr/bin/env bash
set -u

TOTAL=2
PASS=0
FAIL=0

echo "[unit_tests] Running backend unit tests"
if npm run test --workspace backend; then
  PASS=$((PASS + 1))
  echo "[unit_tests] PASS backend"
else
  FAIL=$((FAIL + 1))
  echo "[unit_tests] FAIL backend"
fi

echo "[unit_tests] Running frontend unit/integration tests"
if npm run test --workspace frontend; then
  PASS=$((PASS + 1))
  echo "[unit_tests] PASS frontend"
else
  FAIL=$((FAIL + 1))
  echo "[unit_tests] FAIL frontend"
fi

echo "[unit_tests] Summary: total=${TOTAL} pass=${PASS} fail=${FAIL}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0
