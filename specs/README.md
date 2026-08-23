# MediaTuna specs

One file per topic — history, plan, scope, and testing live together. No parent/child spec trees.

## Living specs (update in place)

Shipped work stays inline with ✅ status. Do not split into archive files.

| Document | Purpose |
|----------|---------|
| [improvements.md](./improvements.md) | Video CLI roadmap — BF/FE items, phases 1–4 (user-facing Phase 4 done; FE-41 parked) |
| [mediatuna.md](./mediatuna.md) | Audio + unified product — phases M1–M4, CLI, testing |
| [testing.md](./testing.md) | Test inventory + backlog (FE-42); ffmpeg TS-10–13 shipped |
| [output-formats.md](./output-formats.md) | Tentative — HEVC-in-MP4 / FLAC-out parked; defaults stay MP4 + MP3 |
| [agents.md](./agents.md) | Tentative — skill first, no MCP; handbook at [docs/agents.md](../docs/agents.md) |

## In flight (`partial/`)

| Document | Milestone |
|----------|-----------|
| [partial/phase-4-engineering.md](./partial/phase-4-engineering.md) | Phase 4 close-out notes; keep until TypeScript is decided |
| [partial/hardening.md](./partial/hardening.md) | Hardening through v1.18.0; leftover HEVC (HS-49) parked in [output-formats.md](./output-formats.md) |

New unstarted specs start at the **root of `specs/`** until work begins, then move here.

## Other

| Document | Purpose |
|----------|---------|
| [public-release-review.md](./public-release-review.md) | One-time pre-publish checklist (2026-06-22) |

User-facing handbook: [docs/](../docs/README.md) (published at [mediatuna.dev/docs](https://mediatuna.dev/docs)). Flag table: [docs/options.md](../docs/options.md).
