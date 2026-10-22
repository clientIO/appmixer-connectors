# Appmixer connector development

The rules for building connectors in this repository are **not kept here**.
They live in the public
**[Appmixer-ai/appmixer-skills](https://github.com/Appmixer-ai/appmixer-skills)**
repository, on its `dev` branch, under
[`instructions/`](https://github.com/Appmixer-ai/appmixer-skills/tree/dev/instructions):

| Topic | File |
|---|---|
| Connector layout, `service.json`, `bundle.json` | `01-connectors.md` |
| Authentication (OAuth 2.0, API key) | `02-authentication.md` |
| Plugins, routes and jobs | `03-plugins.md` |
| `component.json` structure | `05-component-config.md` |
| Component behavior (JavaScript), Context API | `06-component-behavior.md` |
| Component types: Get / Find / List / Create / Update / Delete, triggers | `07-component-types.md` |
| Code style and best practices | `08-best-practices.md` |
| Testing, and a trigger's `test()` method | `09-testing.md`, `10-trigger-test-method.md` |
| E2E test flows: authoring, upload, run | `11-e2e-flow-generation.md` … `13-e2e-run.md` |
| Long-running / async components | `14-async-components.md` |
| Live verification (`appmixer connector verify`) | `15-live-verification.md` |

The same content ships as a **Claude Code plugin** (`build-connector`,
`test-connector`, `review-connector`) — install it from that repository and the
rules load with the skill.

**Do not add rules to this file.** It is a pointer, deliberately: the guide used
to be generated into this repo in full, and the copy silently went stale for ten
days while its sync workflow reported success. To change a rule, open a PR
against appmixer-skills.

Repository-specific notes that are *not* connector rules — branching, where
issues live, the pre-commit hook — are in [`README.md`](../README.md) and
[`.claude/CLAUDE.md`](../.claude/CLAUDE.md).
