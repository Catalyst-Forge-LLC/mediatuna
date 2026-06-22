# Phase 4 — Engineering

**Status:** In flight (v1.7.0) — FE-42/FE-43/FE-40 partial  
**Scope:** Resume, parallelism, module split, TypeScript, automated tests, CI

---

## Goals

- Resume long archives after interrupt
- Optional parallel encodes (NVENC-aware)
- Split `index.js` monolith + TypeScript
- Automated tests + CI smoke

## Items

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| FE-42 | Tests | partial | Unit tests for `lib/*` helpers + argv; integration fixtures pending |
| FE-43 | CI | partial | GitHub Action: `pnpm test`, `--version` / `--help` smoke |
| FE-40 | Module split | partial | `lib/` complete for core pipeline; `index.js` ~380 lines (CLI + interactive delete flows) |
| FE-41 | TypeScript | — | After module split stabilizes |
| FE-20 | `--resume` | — | `.mediatuna-state.json` tracks completed inputs |
| FE-21 | `--jobs N` | — | Cap NVENC sessions; progress UI for parallel workers |

## Shipped this milestone (v1.7.0)

| Module | Contents |
|--------|----------|
| `lib/constants.js` | Extension sets, glob patterns, quality presets |
| `lib/time.js` | `timeToSeconds`, `secondsToHMS`, progress bar formatters |
| `lib/format.js` | `formatSize`, `padEnd`, `shellQuote`, `formatFfmpegError` |
| `lib/tags.js` | Tag normalization, date detection |
| `lib/extensions.js` | Media extension checks, lossy source detection |
| `lib/status.js` | Preflight classify helpers |
| `lib/cli-config.js` | Testable `buildCliConfig()` |
| `lib/audio-policy.js` | M4 smart MP3 skip (prior) |

| `lib/discover.js` | Flat + recursive file discovery |
| `lib/probe.js` | ffprobe parse (`parseProbeResult` testable with JSON fixtures) |
| `lib/encode.js` | ffmpeg arg builders, `runFfmpeg`, NVENC detect, timestamps |
| `lib/verify.js` | Post-encode verification |
| `lib/preflight.js` | Preflight table + entry building |
| `lib/paths.js` | Output path helpers |
| `lib/tools.js` | ffmpeg/ffprobe presence check |

| `lib/run.js` | Conversion batch loop (`runConversion`) |
| `lib/log.js` | Dual-write logger factory |
| `lib/cleanup.js` | Delete/cleanup candidate helpers |
| `lib/resolve-inputs.js` | Input path resolution + mode header |

Run tests: `pnpm test` (61 tests)

## Suggested order (remaining)

1. ~~FE-42 minimal unit tests~~ ✅ (helpers)
2. ~~FE-43 CI wired to tests~~ ✅
3. FE-40 continue module split (`probe`, `discover`, `encode`)
4. FE-20 resume (high user value for long batches)
5. FE-21 parallelism
6. FE-41 TypeScript migration

## Testing

| Test | Type | Status |
|------|------|--------|
| `timeToSeconds`, argv parsing | Unit | ✅ |
| Audio policy (`isNormalizedMp3`, etc.) | Unit | ✅ |
| Probe fixtures: FLAC, MP3, corrupt WMA | Integration | partial (JSON fixtures for parseProbeResult) |
| Metadata round-trip: title/artist/album/date | Integration | — |
| Album art byte compare | Integration | — |
| Lossy warning in preflight | Snapshot CLI | — |
| Skip normalized MP3 | Integration | — |
| Combined mode / extract-audio dry-run | Snapshot CLI | — |

Fixture media must be **synthetic or royalty-free**.

## When shipped

Fold status into [improvements.md](../improvements.md) §6 Phase 4 and [mediatuna.md](../mediatuna.md) §13; delete this file.
