# Beehiiv Connector — TypeScript POC

This directory contains a proof-of-concept TypeScript conversion of the Beehiiv connector.
The `.ts` files coexist alongside the original `.js` files; neither replaces the other.

---

## How Node 24 native TypeScript support works

Node 24 ships with `--experimental-strip-types` (stabilised in Node 22.6+, production-ready
by Node 23/24). When this flag is active, Node strips TypeScript-only syntax from `.ts` files
before executing them — no compilation step, no `tsc`, no `tsconfig.json` required.

**What "strip-types" means in practice:**

| TypeScript feature | Behaviour under strip-types |
|---|---|
| `interface`, `type`, `import type` | Fully removed — zero runtime cost |
| `: SomeType` parameter/return annotations | Removed |
| `as SomeType` casts | Removed |
| `<T>` generics on functions/classes | Removed |
| `enum` | **NOT supported** — enums emit real JS code and require `tsc` |
| `namespace` with values | **NOT supported** — same reason |
| Decorators | **NOT supported** without `--experimental-transform-types` |

The module system (CJS vs ESM) is determined by the usual rules (`"type"` in `package.json`,
file extension). Since Appmixer connectors use CommonJS, the `.ts` files here keep
`module.exports` / `require()` and simply add TypeScript annotations on top.

---

## How to run / test

```bash
# Run a single file directly (Node 24)
node --experimental-strip-types src/appmixer/beehiiv/lib.ts

# Run a component file
node --experimental-strip-types src/appmixer/beehiiv/core/ListPublications/ListPublications.ts

# If you want type-checking (separate step, not required at runtime)
npx tsc --noEmit --strict src/appmixer/beehiiv/types.ts
```

---

## Files converted in this POC

| TypeScript file | Source |
|---|---|
| `types.ts` | New — shared interfaces/types for the whole connector |
| `auth.ts` | Converted from `auth.js` |
| `lib.ts` | Converted from `lib.js` |
| `api.ts` | Partial — first 4 operations (`Index`, `Index2`, `Create`, `Show`, `Index3`) |
| `core/CreateSubscriber/CreateSubscriber.ts` | Converted from `CreateSubscriber.js` |
| `core/ListPublications/ListPublications.ts` | Converted from `ListPublications.js` |

The remaining operations in `api.js` follow exactly the same pattern demonstrated in `api.ts`.

---

## What this POC demonstrates

1. **Zero-build TypeScript** — `.ts` files run directly under Node 24 with no build tooling.
2. **`import type` in CJS files** — type-only imports are fully stripped, leaving valid CJS.
3. **Typed Appmixer context** — `AppmixerContext` interface (`types.ts`) gives IDE
   autocompletion and documents the runtime contract for `context.httpRequest`,
   `context.sendJson`, etc.
4. **Generic API response types** — `BeehiivApiListResponse<T>` / `BeehiivApiItemResponse<T>`
   propagate item types through `httpRequest<T>()` calls.
5. **Typed operation objects** — `ApiOperation<TParams, TResult>` interface enforces
   consistent shape across all API operations in `api.ts`.
6. **Input destructuring with interfaces** — component `receive()` functions cast
   `context.messages.in.content` to a typed interface, making all expected fields explicit.

---

## Known limitations

- **No type-checking at runtime** — strip-types only removes syntax; type errors are silently
  ignored unless you run `tsc --noEmit` separately.
- **No `enum`** — use string union types (`type OutputType = 'array' | 'object' | ...`) instead.
- **No decorators** — not needed for Appmixer connectors.
- **`require()` not typed by default** — variables from `require()` calls are `any` unless
  cast (e.g. `require('path') as typeof import('path')`).
- **`import type` only for cross-file types** — you cannot use `import` (value) in a CJS
  `.ts` file; stick to `require()` for runtime imports and `import type` for types.
- **No `tsconfig.json`** — path aliases and `baseUrl` are not available. Use relative paths.
