# Phase 4 — Engineering

**Status:** Not started  
**Scope:** Resume, parallelism, module split, TypeScript, automated tests, CI  
**Related:** [improvements.md](./improvements.md) §6 Phase 4, [mediatuna.md](./mediatuna.md) §13 testing

---

## Goals

- Resume long archives after interrupt
- Optional parallel encodes (NVENC-aware)
- Split `index.js` monolith + TypeScript
- Automated tests + CI smoke

## Items

| ID | Feature | Notes |
|----|---------|-------|
| FE-20 | `--resume` | `.mediatuna-state.json` tracks completed inputs |
| FE-21 | `--jobs N` | Cap NVENC sessions; progress UI for parallel workers |
| FE-40 | Module split | `cli`, `discover`, `probe`, `encode`, `progress`, `log` |
| FE-41 | TypeScript | Align with project conventions |
| FE-42 | Tests | Unit + ffprobe JSON fixtures |
| FE-43 | CI | GitHub Action: install, test, dry-run |

## Suggested order

1. FE-42 minimal unit tests (extract pure helpers first)
2. FE-43 CI wired to tests
3. FE-40 module split (guided by tests)
4. FE-20 resume (high user value for long batches)
5. FE-21 parallelism

## Testing (from mediatuna.md §13)

| Test | Type | Status |
|------|------|--------|
| `timeToSeconds`, argv parsing | Unit | — |
| Probe fixtures: FLAC, MP3, corrupt WMA | Integration | — |
| Metadata round-trip: title/artist/album/date | Integration | — |
| Album art byte compare | Integration | — |
| Lossy warning in preflight | Snapshot CLI | — |
| Skip normalized MP3 | Integration | — |
| Combined mode / extract-audio dry-run | Snapshot CLI | — |

Fixture media must be **synthetic or royalty-free**.

## Dependencies

M4 smart skip and combined-mode snapshots benefit from FE-42/FE-43 landing first. Audio policy unit tests already exist (`lib/audio-policy.js`, `pnpm test`).

## When shipped

Fold status into [improvements.md](./improvements.md) §6 Phase 4 and [mediatuna.md](./mediatuna.md) §13; delete this file.
