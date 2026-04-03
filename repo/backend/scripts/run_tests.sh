#!/usr/bin/env sh
set -eu

UNIT_STATUS="PASS"
API_STATUS="PASS"

echo "=== Backend Unit Tests ==="
if ! npm run test; then
  UNIT_STATUS="FAIL"
fi

echo "=== Backend API Tests ==="
if ! npm run test:e2e; then
  API_STATUS="FAIL"
fi

echo "=== Backend Test Summary ==="
echo "$UNIT_STATUS - Unit Tests"
echo "$API_STATUS - API Tests"

if [ "$UNIT_STATUS" = "FAIL" ] || [ "$API_STATUS" = "FAIL" ]; then
  echo "Overall: FAIL"
  exit 1
fi

echo "Overall: PASS"
