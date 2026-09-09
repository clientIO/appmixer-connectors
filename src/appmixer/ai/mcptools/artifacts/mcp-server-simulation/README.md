# MCP Server simulation (script-driven checks)

`artifacts/test-flows/test-flow-mcpgateway-tools.json` is the E2E flow the
standard runner executes (`appmixer e2e import` / `run`): the gateway announces
its webhook on the `out` port and the flow calls its own tools through it.

What a flow cannot reach is the part of the module that lives outside the flow:
the plugin routes, the SSE endpoint and the HTTP error contract of the webhook.
`run-e2e-test.sh` covers those by acting as the Appmixer MCP Server would —
it reads the gateway registry over the API, calls the webhook and checks the
responses.

```bash
bash run-e2e-test.sh
```

10 checks: gateway registration, tool count, public tool structure (no internal
`_` keys, names within 64 chars), the parameter model (a field marked with
`Model Defined Parameter` becomes a tool parameter, a literal one does not),
EchoTool and GreetTool calls, unknown tool → 404, malformed arguments → 400,
and SSE `/events` → 401 without a token.

The flow here is kept out of `artifacts/test-flows/` on purpose: it has no
`OnStart`/`Assert`/`ProcessE2EResults` chain, so the E2E runner's validator
would reject it.
