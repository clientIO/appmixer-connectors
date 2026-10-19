# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Full development guide:** the [`instructions/`](https://github.com/Appmixer-ai/appmixer-skills/tree/dev/instructions) directory of the public [appmixer-skills](https://github.com/Appmixer-ai/appmixer-skills) repository — the source of truth for connector rules, also installable as a Claude Code plugin. `.github/copilot-instructions.md` here is only a pointer to it.

## Quick Reference

### Commands

```bash
# Install dependencies
node scripts/npm_install.js

# Run tests
npm run test-unit
npm run test-unit -- test/<connector_name>

# Linting
npm run lint

# Validation while developing a connector (strict: thresholds ignored,
# prints every failure and warning) — ALWAYS prefer this scoped form
node scripts/validate.js --connector <connector_name>

# Strict validation of files changed on the branch (used by pre-commit)
node scripts/validate.js --changed

# Repository-wide validation (threshold/ratchet mode — legacy debt is
# tolerated, so new issues in your connector can hide under a threshold)
npm run validate

# Validate outputType components
npm run validate-outputtype
```

When working on a single connector, always validate with `--connector <name>`; use `--changed` when changes span multiple connectors. Run repo-wide `npm run validate` after major refactors so bundle metadata, component schema/inspector pairs, and quota resource references stay in sync.

### Connector Structure

```
src/appmixer/<connector_name>/
├── service.json       # Service metadata
├── auth.js           # Authentication (OAuth2 or API key)
├── bundle.json       # Version and changelog
├── lib.js            # Shared utilities (REQUIRED for outputType components)
└── core/
    └── <ComponentName>/
        ├── component.json
        └── <ComponentName>.js
```

See: [`01-connectors.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/01-connectors.md) — "Connector Structure", "Core Configuration Files"

### Authentication

- **OAuth 2.0**: For services with OAuth flow (Google, GitHub, etc.)
- **API Key**: For services using API keys or tokens

See: [`02-authentication.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/02-authentication.md)

### Component Types

| Type | Purpose | Key Rule |
|------|---------|----------|
| **Get** | Single item by ID | Returns item data |
| **List** | All items, no filtering | Uses `outputType`, no limit/offset |
| **Find** | Search with filters | Uses `outputType`, has `notFound` port |
| **Create** | Create new item | Returns created item |
| **Update** | Modify by ID | Returns `{}` |
| **Delete** | Remove by ID | Returns `{}` |

See: [`07-component-types.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/07-component-types.md) — the Find / List / Get / Create / Update / Delete sections

**Triggers**: Use `properties` (not `inPorts`), implement `tick()` or `start()/receive()/stop()`

See: [`07-component-types.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/07-component-types.md) — "Trigger Components", and [`10-trigger-test-method.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/10-trigger-test-method.md) for `test()`

## Critical Rules

### outputType Components (REQUIRED)

Components with `outputType` **MUST** use lib.js helpers:
- `lib.sendArrayOutput({ context, outputType, records })`
- `lib.getOutputPortOptions(context, outputType, schema, { label })`
- Array output field: always `result` (not `records`)

**Canonical implementation:** `appmixer-cli/src/ai/src/templates/libs/lib.js`

See: [`07-component-types.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/07-component-types.md) — "outputType Helper Functions", and [`15-live-verification.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/15-live-verification.md) for exporting `ITEM_SCHEMA`

### Delete/Update Components

```javascript
// MUST return empty object
return context.sendJson({}, 'out');
```

### Required Input Validation

```javascript
if (!taskId) {
    throw new context.CancelError('Task ID is required!');
}
```

See: [`06-component-behavior.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/06-component-behavior.md) and [`08-best-practices.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/08-best-practices.md)

### Output Port Schema

Use **either** `schema` or `options` in outPorts, **NOT both**. JSON Schema (`schema`) is PREFERRED over the `options[]` array form.

Add a realistic `example` (singular, not `examples` array) on each leaf property — it powers the variable picker preview.

```json
"outPorts": [{
    "name": "out",
    "schema": {
        "type": "object",
        "properties": {
            "id": { "type": "string", "title": "ID", "example": "1001" },
            "completed": { "type": "boolean", "title": "Completed", "example": false }
        }
    }
}]
```

See: [`05-component-config.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/05-component-config.md) — output port schema and examples

## Testing Components

```bash
# Validate auth first
appmixer test auth validate ./src/appmixer/<connector>/auth.js

# Test component
appmixer test component ./src/appmixer/<connector>/core/<Component> -i '{"in":{...}}'
```

See: [`09-testing.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/09-testing.md)

## E2E Test Flows

Required components in order:
1. `OnStart` → `SetVariable` → Components under test → `Assert` → `AfterAll` → Cleanup → `ProcessE2EResults`

**Critical:**
- Assertion types: `equal`, `notEmpty`, `regex` only
- Every component MUST be tested in at least one flow

See: [`11-e2e-flow-generation.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/11-e2e-flow-generation.md), [`12-e2e-upload.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/12-e2e-upload.md), [`13-e2e-run.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/13-e2e-run.md)

## Code Style

- 4 spaces indentation
- camelCase for JS variables
- Date fields: use `date-time` inspector type, not `text`
- Remove unused variables/imports

See: [`08-best-practices.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/08-best-practices.md)

## Reference

- **Full guide:** [appmixer-skills `instructions/`](https://github.com/Appmixer-ai/appmixer-skills/tree/dev/instructions) — the source of truth
- **External docs:** https://docs.appmixer.com/getting-started/custom-connectors

### Where each topic lives in appmixer-skills

| Topic | File |
|-------|------|
| Input/output types, JSON Schema reference | [`05-component-config.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/05-component-config.md) |
| component.json structure and attribute order | [`05-component-config.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/05-component-config.md) |
| Context API | [`06-component-behavior.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/06-component-behavior.md), [`03-plugins.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/03-plugins.md) |
| AI-specific rules and restrictions | [`16-agent-instructions.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/16-agent-instructions.md) |
| Long-running / async components | [`14-async-components.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/14-async-components.md) |
| Live verification, `ITEM_SCHEMA`, `verify.json` | [`15-live-verification.md`](https://github.com/Appmixer-ai/appmixer-skills/blob/dev/instructions/15-live-verification.md) |
