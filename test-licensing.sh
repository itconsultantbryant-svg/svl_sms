#!/bin/bash

# SVL-SMS Licensing System Test Script
# Tests all licensing endpoints

BASE_URL="http://localhost:10000/api"
ADMIN_TOKEN="YOUR_ADMIN_TOKEN_HERE"
USER_TOKEN="YOUR_USER_TOKEN_HERE"
INSTITUTION_ID="inst_test_001"
MACHINE_ID="test-device-$(date +%s)"

echo "=================================="
echo "SVL-SMS Licensing System Test"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local token=$5

  echo -e "${YELLOW}Testing:${NC} $name"
  echo "  ${method} ${BASE_URL}${endpoint}"

  if [ -z "$token" ]; then
    curl -s -X "$method" "${BASE_URL}${endpoint}" \
      -H "Content-Type: application/json" \
      -d "$data" | jq '.' 2>/dev/null || echo "Invalid JSON response"
  else
    curl -s -X "$method" "${BASE_URL}${endpoint}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${token}" \
      -d "$data" | jq '.' 2>/dev/null || echo "Invalid JSON response"
  fi
  echo ""
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ Server not running at ${BASE_URL}${NC}"
  echo "Start the server with: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Test 1: Generate License Key (Admin)
echo "--- TEST 1: Generate License Key (Admin Only) ---"
test_endpoint \
  "Generate Test License" \
  "POST" \
  "/licensing/generate-key" \
  "{\"institution_id\": \"${INSTITUTION_ID}\", \"plan_tier\": \"basic\", \"mode\": \"demo\", \"expiry_days\": 30}" \
  "$ADMIN_TOKEN"

# Store license key from response (you'll need to manually copy this)
echo "📌 NOTE: Copy the licenseKey from above for the next test"
echo ""

# Test 2: Activate License
echo "--- TEST 2: Activate License on Machine ---"
test_endpoint \
  "Activate Demo License" \
  "POST" \
  "/licensing/activate" \
  "{\"license_key\": \"SVL-TEST-DEMO-KEY\", \"machine_id\": \"${MACHINE_ID}\"}" \
  ""

echo "📌 Replace SVL-TEST-DEMO-KEY with the license from Test 1"
echo ""

# Test 3: Check License Status
echo "--- TEST 3: Check License Status (Authenticated) ---"
test_endpoint \
  "Check License Status" \
  "GET" \
  "/licensing/check" \
  "" \
  "$USER_TOKEN"

echo ""

# Test 4: License Check-in
echo "--- TEST 4: Periodic Check-in (Phone Home) ---"
test_endpoint \
  "License Check-in" \
  "POST" \
  "/licensing/check-in" \
  "{\"machine_id\": \"${MACHINE_ID}\"}" \
  "$USER_TOKEN"

echo ""

# Test 5: Demo Mode Status
echo "--- TEST 5: Check Demo Mode Status ---"
test_endpoint \
  "Get Demo Mode Status" \
  "GET" \
  "/demo-mode/status" \
  "" \
  "$USER_TOKEN"

echo ""

# Test 6: Setup Demo Mode
echo "--- TEST 6: Setup Demo Mode for Institution ---"
test_endpoint \
  "Setup Demo Mode" \
  "POST" \
  "/demo-mode/setup" \
  "" \
  "$USER_TOKEN"

echo ""

# Test 7: Invalid License Key
echo "--- TEST 7: Test Invalid License Key ---"
test_endpoint \
  "Activate Invalid License" \
  "POST" \
  "/licensing/activate" \
  "{\"license_key\": \"INVALID-KEY\", \"machine_id\": \"${MACHINE_ID}\"}" \
  ""

echo ""

echo "=================================="
echo "Test Complete!"
echo "=================================="
echo ""
echo "Notes:"
echo "1. Replace YOUR_ADMIN_TOKEN_HERE with a platform admin JWT token"
echo "2. Replace YOUR_USER_TOKEN_HERE with a regular user JWT token"
echo "3. Replace SVL-TEST-DEMO-KEY with the actual license key from Test 1"
echo "4. Some tests require valid tokens - see output for 401 errors"
echo ""
