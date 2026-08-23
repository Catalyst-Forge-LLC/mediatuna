# MediaTuna test suite

**Status:** Inventory current; cheap units TS-01–05/07 in v1.18.1; ffmpeg TS-10–13 in v1.19.0  
**Date:** 2026-08-23  
**Related:** [improvements.md](./improvements.md) FE-42, [mediatuna.md](./mediatuna.md) §13, [partial/hardening.md](./partial/hardening.md) §6

What `pnpm test` covers today, what CI runs, and which extra tests would actually reduce archive risk. Passing tests are **assurance, not a guarantee**.

When work on a chunk starts, move this file to [partial/](./partial/).

---

## 1. What exists (v1.19.0)

`pnpm test` → `node --test test/**/*.test.js`. About **193** cases. Four ffmpeg-backed cases **skip** unless `ffmpeg` / `ffprobe` are on PATH (`pnpm test:ffmpeg` requires them).

GitHub Actions: unit + `--version` / `--help` on Ubuntu + Node 22; a second job installs ffmpeg and runs `pnpm test:ffmpeg`. CI does **not** talk to Everything or exercise Windows Recycle Bin. Fixtures are lavfi color + sine, not family tapes.

| Area | File | What it proves |
|------|------|----------------|
| CLI flag matrix | `test/cli-config.test.js` | Conflicting flags fail; archive / sample / globs / resume parse |
| Discovery + globs | `test/globs.test.js`, `test/cleanup-resolve.test.js` | Include/exclude, single-file allowlist |
| Preflight / paths | `test/preflight.test.js`, `test/status.test.js` | Table wording; empty output is not `skip (exists)` |
| Encode args | `test/encode.test.js` | NVENC floor, yadif, `--sample -t`, AAC copy vs `--reencode-audio` |
| Verify helpers | — | **Gap** — duration math lives in `lib/verify.js` with no unit file |
| Resume | `test/resume-state.test.js` | runKey, skip when outputs still verify |
| Deletes / trash | `test/cleanup-resolve.test.js`, `test/trash.test.js` | Trash vs unlink (mocked exec); eligible `skip (exists)` |
| Archive | `test/archive.test.js` | Relative dest; real temp-dir move |
| Recup | `test/recup-map.test.js` | Placement score; SHA-256 required before cleanup |
| Dupes | `test/dupe-report.test.js` | “not hashed” headings; mocked Everything |
| Stamp dates | `test/stamp-dates.test.js` | Filename + probe dates; dry-run / backup |
| Probe JSON | `test/probe.test.js` + `test/fixtures/ffprobe/` | Parse fixtures (not live ffprobe) |
| Safety copy | `test/safety.test.js` | Write banner, disk-space mock, lossy banner |
| Audio policy | `test/audio-policy.test.js` | LAME map, normalized-MP3 skip rules |
| Jobs | `test/jobs.test.js` | Cap + concurrency helper |

**Not covered by automation today:** live ffmpeg encode, live ffprobe on files, TTY confirm scripts, Everything on a real index, Windows Recycle Bin, `index.js` as a process except `--help` / `--version` in CI.

---

## 2. Tests worth adding

Priority is “would this catch a sad archive?” not coverage percentage.

### 2.1 Cheap unit (no ffmpeg)

| ID | Why | Notes |
|----|-----|-------|
| TS-01 | ✅ | **`verifyOutput` duration window** | `durationWithinTolerance` — `max(2s, 5%)`. |
| TS-02 | ✅ | **`sha256File` round-trip** | Same vs different temp files. |
| TS-03 | ✅ | **`sampleDuration`** | Null sample, clip shorter than N, clip longer than N. |
| TS-04 | ✅ | **More CLI rejects** | `--archive` + `--delete-originals`; `--sample` + `--resume`; `--sample` + `0`. |
| TS-05 | ✅ | **`discoverFiles` + globs** | Temp tree: `previews/` excluded. |
| TS-06 | — | **`--dry-run` cleanup never calls trash/unlink** | Index is hard; extract `planCleanupAction()` later. |
| TS-07 | ✅ | **`withSampleLimit` placement** | `-t` sits after the input path. |

### 2.2 ffmpeg-backed (opt-in)

Run only when `ffmpeg` / `ffprobe` are on PATH (local + optional CI job). Fixture media: **synthetic only** (lavfi color + sine, a few seconds). No family tapes.

| ID | Why | Notes |
|----|-----|-------|
| TS-10 | ✅ | **`--sample 2` writes `*.sample.mp4` only** | Duration ~2s; no `clip.mp4` next to it. |
| TS-11 | ✅ | **Full convert then `--verify`** | Synthetic 5s AVI → duration within tolerance. |
| TS-12 | ✅ | **Empty existing `.mp4` is re-encoded** | Pre-create 0-byte dest; after run it must be a real media file. |
| TS-13 | ✅ | **Normalized MP3 skip** | Tagged MP3 above the bitrate floor; second run is `skip (normalized)`. |
| TS-14 | — | **`--output` tree** | `in/2008/a.avi` → `out/2008/a.mp4` (or stamped name). |
| TS-15 | — | **`--archive` after convert** | Source leaves the inbox; dest exists under archive root. |
| TS-16 | — | **Failed encode removes partial** | Force a bad input; dest gone unless `--keep-partial`. |

Layout: `test/integration/ffmpeg.test.js` + `test/helpers/ffmpeg.js`. Cases skip unless ffmpeg is on PATH. `MEDIATUNA_FFMPEG_TESTS=1` (CI `ffmpeg` job / `pnpm test:ffmpeg`) fails the suite if ffmpeg is missing. Default `pnpm test` stays fast when ffmpeg is absent.

### 2.3 Manual / Windows

| ID | Why |
|----|-----|
| TS-20 | Recycle Bin: `--delete-originals` on one file; confirm it appears in the bin, not gone. |
| TS-21 | `--delete-permanent` + type `DELETE` unlinks; Recycle Bin empty. |
| TS-22 | TTY: `--force` with two existing outputs prompts; `--yes` skips that prompt but still asks before delete. |
| TS-23 | Everything: `--dupe-report --hash` on a folder you already know. |

---

## 3. What not to chase

- Pixel / PCM compare of encodes (verify is duration by design).
- Full PhotoRec dumps or personal paths (privacy).
- Snapshotting the entire HELP string (churn).
- 100% line coverage of `index.js` prompts.

---

## 4. README / user-facing

Tell people the suite exists and what it is **not**. Link this spec from [docs/safety.md](../docs/safety.md). Do not imply CI watched their archive.

---

## 5. Suggested order

1. ~~TS-01–TS-05, TS-07~~ ✅ in v1.18.1. TS-06 still open.
2. ~~TS-10 + TS-12~~ ✅ in v1.19.0.
3. ~~TS-11 / TS-13~~ ✅ in v1.19.0 (CI `ffmpeg` job).
4. Leave TS-20–TS-23 as a short manual checklist in this file. TS-14–16 next if another encode regression shows up.
