#!/bin/bash
# E2E Test for MCPGateway component
# Tests: gateway registration, tool listing ('tool' port + Model Defined Parameter),
#        webhook tool calling (static component call), error responses
#
# Prerequisites:
#   - appmixer CLI authenticated (appmixer login)
#   - ai.mcptools module published to dev instance
#
# Usage: bash run-e2e-test.sh

set -euo pipefail

APPMIXER_URL="https://api-dev-automated-00001.dev.appmixer.ai"
TOKEN=$(appmixer login -t 2>/dev/null)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOW_FILE="$SCRIPT_DIR/test-flow-gateway-tools.json"
FLOW_ID=""

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
pass() { echo "  ✅ $*"; }
fail() { echo "  ❌ $*"; FAILURES=$((FAILURES + 1)); }

FAILURES=0
TESTS=0

cleanup() {
    if [[ -n "$FLOW_ID" ]]; then
        log "Cleanup: stopping and deleting flow $FLOW_ID"
        curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"command":"stop"}' \
            "$APPMIXER_URL/flows/$FLOW_ID/coordinator" > /dev/null 2>&1 || true
        sleep 2
        curl -sf -X DELETE -H "Authorization: Bearer $TOKEN" \
            "$APPMIXER_URL/flows/$FLOW_ID" > /dev/null 2>&1 || true
        log "Cleanup done"
    fi
}
trap cleanup EXIT

# ═══════════════════════════════════════════
# 1. Create flow from JSON
# ═══════════════════════════════════════════
log "Step 1: Creating flow from $FLOW_FILE"
FLOW_JSON=$(cat "$FLOW_FILE")
CREATE_RESP=$(curl -sf -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$FLOW_JSON" \
    "$APPMIXER_URL/flows")
FLOW_ID=$(echo "$CREATE_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('flowId', d.get('_id', '')))" 2>/dev/null || echo "")

if [[ -z "$FLOW_ID" ]]; then
    log "Failed to create flow. Response:"
    echo "$CREATE_RESP"
    exit 1
fi
export FLOW_ID
log "Flow created: $FLOW_ID"

# ═══════════════════════════════════════════
# 2. Start the flow
# ═══════════════════════════════════════════
log "Step 2: Starting flow"
START_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"command":"start"}' \
    "$APPMIXER_URL/flows/$FLOW_ID/coordinator" 2>&1)
START_CODE=$(echo "$START_RESP" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)
log "  Start response (HTTP $START_CODE): $(echo "$START_RESP" | head -3)"
if [[ "$START_CODE" != "200" && "$START_CODE" != "204" && "$START_CODE" != "202" ]]; then
    log "WARNING: Flow start returned HTTP $START_CODE"
fi

log "Waiting 8s for MCPGateway to initialize and register..."
sleep 8

# ═══════════════════════════════════════════
# 3. Test: Gateway registered in /gateways
# ═══════════════════════════════════════════
TESTS=$((TESTS + 1))
log "Test 1: GET /plugins/appmixer/ai/mcptools/gateways"
GATEWAYS=$(curl -sf -H "Authorization: Bearer $TOKEN" \
    "$APPMIXER_URL/plugins/appmixer/ai/mcptools/gateways" 2>/dev/null || echo "[]")

# Filter gateways for THIS flow only
OUR_GATEWAY=$(echo "$GATEWAYS" | python3 -c "
import json, sys, os
data = json.load(sys.stdin)
flow_id = os.environ.get('FLOW_ID', '')
ours = [g for g in data if g.get('flowId') == flow_id]
print(json.dumps(ours))
" 2>/dev/null || echo "[]")
GATEWAY_COUNT=$(echo "$OUR_GATEWAY" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [[ "$GATEWAY_COUNT" -gt 0 ]]; then
    pass "Gateway registered for flow $FLOW_ID ($GATEWAY_COUNT found)"
else
    fail "No gateway found for flow $FLOW_ID (total gateways: $(echo "$GATEWAYS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"))"
    echo "  All gateways: $GATEWAYS"
fi

# ═══════════════════════════════════════════
# 4. Test: Gateway has tools defined
# ═══════════════════════════════════════════
TESTS=$((TESTS + 1))
log "Test 2: Gateway has tools (EchoTool, GreetTool)"
TOOLS_COUNT=$(echo "$OUR_GATEWAY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data:
    gw = data[0]
    tools = gw.get('tools', [])
    print(len(tools))
else:
    print(0)
" 2>/dev/null || echo "0")

if [[ "$TOOLS_COUNT" -ge 2 ]]; then
    pass "Gateway has $TOOLS_COUNT tools"
else
    fail "Expected at least 2 tools, got $TOOLS_COUNT"
    echo "  Gateway: $OUR_GATEWAY"
fi

# ═══════════════════════════════════════════
# 5. Test: Tool definitions have correct structure
# ═══════════════════════════════════════════
TESTS=$((TESTS + 1))
log "Test 3: Tool definitions have name, description; no internal _ metadata leaks"
TOOL_VALID=$(echo "$OUR_GATEWAY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('no_gateways')
    sys.exit()
tools = data[0].get('tools', [])
problems = []
for tool in tools:
    func = tool.get('function', {})
    if tool.get('type') != 'function':
        problems.append('type!=function')
    if not func.get('name'):
        problems.append('missing name')
    if len(func.get('name', '')) > 64:
        problems.append('name > 64 chars')
    if not func.get('description'):
        problems.append('missing description')
    leaked = [k for k in func if k.startswith('_')]
    if leaked:
        problems.append('leaked internal keys: ' + ','.join(leaked))
print('valid' if not problems else '; '.join(problems))
" 2>/dev/null || echo "error")

if [[ "$TOOL_VALID" == "valid" ]]; then
    pass "All tools have valid public structure (type, name, description, no _ keys)"
else
    fail "Tool structure invalid: $TOOL_VALID"
fi

# ═══════════════════════════════════════════
# 6. Test: Model Defined Parameter → tool parameter; static value → no parameters
# ═══════════════════════════════════════════
TESTS=$((TESTS + 1))
log "Test 4: EchoTool exposes 'value' parameter (Model Defined Parameter), GreetTool has none (static)"
PARAMS_CHECK=$(echo "$OUR_GATEWAY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('no_gateways')
    sys.exit()
tools = {t['function']['name']: t['function'] for t in data[0].get('tools', [])}
echo = next((f for n, f in tools.items() if n.startswith('echo-tool_')), None)
greet = next((f for n, f in tools.items() if n.startswith('greet-tool_')), None)
problems = []
if not echo:
    problems.append('EchoTool missing')
else:
    props = echo.get('parameters', {}).get('properties', {})
    if 'value' not in props:
        problems.append('EchoTool has no value parameter: ' + json.dumps(echo.get('parameters')))
    if 'value' not in echo.get('parameters', {}).get('required', []):
        problems.append('EchoTool value not required')
if not greet:
    problems.append('GreetTool missing')
elif 'parameters' in greet:
    problems.append('GreetTool should have no parameters (static value): ' + json.dumps(greet['parameters']))
print('valid' if not problems else '; '.join(problems))
" 2>/dev/null || echo "error")

if [[ "$PARAMS_CHECK" == "valid" ]]; then
    pass "Parameter model correct (AI field → parameter, static field → none)"
else
    fail "Parameter model wrong: $PARAMS_CHECK"
fi

# ═══════════════════════════════════════════
# 7. Test: Webhook URL exists and is callable
# ═══════════════════════════════════════════
TESTS=$((TESTS + 1))
log "Test 5: Gateway has webhook URL"
WEBHOOK_URL=$(echo "$OUR_GATEWAY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data:
    print(data[0].get('webhook', ''))
else:
    print('')
" 2>/dev/null || echo "")

if [[ -n "$WEBHOOK_URL" ]]; then
    pass "Webhook URL found: ${WEBHOOK_URL:0:80}..."
else
    fail "No webhook URL in gateway"
fi

tool_name_by_prefix() {
    echo "$OUR_GATEWAY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data:
    for tool in data[0].get('tools', []):
        if tool['function']['name'].startswith('$1'):
            print(tool['function']['name'])
            break
" 2>/dev/null || echo ""
}

call_tool() {
    # $1 = tool name, $2 = arguments JSON (object)
    # Same body shape as the Appmixer MCP Server (appmixer-mcp index.js): { function: { name, arguments } }.
    # The engine delivers the body to the component as context.messages.webhook.content.data.
    curl -s --max-time 60 -X POST \
        -H "Content-Type: application/json" \
        -d "{\"function\":{\"name\":\"$1\",\"arguments\":$2}}" \
        "$WEBHOOK_URL" 2>/dev/null || echo "TIMEOUT_OR_ERROR"
}

if [[ -n "$WEBHOOK_URL" ]]; then
    # ═══════════════════════════════════════════
    # 8. Test: Call webhook with EchoTool (model-defined parameter)
    # ═══════════════════════════════════════════
    TESTS=$((TESTS + 1))
    log "Test 6: Call EchoTool via webhook (static component call with model-defined 'value')"
    ECHO_TOOL_NAME=$(tool_name_by_prefix 'echo-tool_')

    if [[ -n "$ECHO_TOOL_NAME" ]]; then
        log "  Calling tool: $ECHO_TOOL_NAME"
        WEBHOOK_RESP=$(call_tool "$ECHO_TOOL_NAME" '{"value":"hello world"}')
        if echo "$WEBHOOK_RESP" | grep -q "hello world"; then
            pass "EchoTool returned: ${WEBHOOK_RESP:0:120}"
        else
            fail "EchoTool did not echo the model-defined value. Response: ${WEBHOOK_RESP:0:300}"
        fi
    else
        fail "Could not find EchoTool name in tools list"
    fi

    # ═══════════════════════════════════════════
    # 9. Test: Call webhook with GreetTool (static value, no parameters)
    # ═══════════════════════════════════════════
    TESTS=$((TESTS + 1))
    log "Test 7: Call GreetTool via webhook (static user value, no arguments)"
    GREET_TOOL_NAME=$(tool_name_by_prefix 'greet-tool_')

    if [[ -n "$GREET_TOOL_NAME" ]]; then
        log "  Calling tool: $GREET_TOOL_NAME"
        WEBHOOK_RESP=$(call_tool "$GREET_TOOL_NAME" '{}')
        if echo "$WEBHOOK_RESP" | grep -q "Hello, Appmixer!"; then
            pass "GreetTool returned: ${WEBHOOK_RESP:0:120}"
        else
            fail "GreetTool did not return the static value. Response: ${WEBHOOK_RESP:0:300}"
        fi
    else
        fail "Could not find GreetTool name in tools list"
    fi

    # ═══════════════════════════════════════════
    # 10. Test: Unknown tool → 404, malformed arguments → 400
    # ═══════════════════════════════════════════
    TESTS=$((TESTS + 1))
    log "Test 8: Unknown tool name returns 404"
    UNKNOWN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST \
        -H "Content-Type: application/json" \
        -d '{"function":{"name":"no-such-tool_x","arguments":{}}}' \
        "$WEBHOOK_URL" 2>/dev/null || echo "000")
    if [[ "$UNKNOWN_CODE" == "404" ]]; then
        pass "Unknown tool → 404"
    else
        fail "Unknown tool returned HTTP $UNKNOWN_CODE (expected 404)"
    fi

    TESTS=$((TESTS + 1))
    log "Test 9: Malformed JSON arguments return 400"
    MALFORMED_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST \
        -H "Content-Type: application/json" \
        -d "{\"function\":{\"name\":\"${ECHO_TOOL_NAME:-x}\",\"arguments\":\"{not json\"}}" \
        "$WEBHOOK_URL" 2>/dev/null || echo "000")
    if [[ "$MALFORMED_CODE" == "400" ]]; then
        pass "Malformed arguments → 400"
    else
        fail "Malformed arguments returned HTTP $MALFORMED_CODE (expected 400)"
    fi
fi

# ═══════════════════════════════════════════
# 11. Test: SSE endpoint is accessible
# ═══════════════════════════════════════════
TESTS=$((TESTS + 1))
log "Test 10: SSE /events endpoint returns 401 without token"
SSE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    "$APPMIXER_URL/plugins/appmixer/ai/mcptools/events" 2>/dev/null)

if [[ "$SSE_STATUS" == "401" ]]; then
    pass "SSE endpoint correctly returns 401 without token"
elif [[ "$SSE_STATUS" == "000" ]]; then
    fail "SSE endpoint unreachable"
else
    fail "SSE endpoint returned unexpected status: $SSE_STATUS"
fi

# ═══════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
if [[ "$FAILURES" -eq 0 ]]; then
    echo "  ✅ ALL $TESTS TESTS PASSED"
else
    echo "  ❌ $FAILURES/$TESTS TESTS FAILED"
fi
echo "═══════════════════════════════════════════"

exit "$FAILURES"
