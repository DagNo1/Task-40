#!/usr/bin/env bash
set -u

TOTAL=1
PASS=0
FAIL=0

echo "[API_tests] Running backend API functional tests"
if npm run test:e2e --workspace backend; then
  PASS=$((PASS + 1))
  echo "[API_tests] PASS backend API functional tests"
else
  FAIL=$((FAIL + 1))
  echo "[API_tests] FAIL backend API functional tests"
fi

echo "[API_tests] Summary: total=${TOTAL} pass=${PASS} fail=${FAIL}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0
