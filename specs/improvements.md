# MediaTuna Improvement Spec

**Status:** Active — Phases 1–3 shipped; Phase 4 user-facing close-out done — [partial/phase-4-engineering.md](./partial/phase-4-engineering.md)  
**Last reviewed:** 2026-08-23  
**Scope:** Bug fixes, UX polish, and feature roadmap for the MediaTuna CLI

> Formerly VidTuna — rebranded 2026-06-22. GitHub repo: `Catalyst-Forge-LLC/mediatuna`.

---

## 1. Current State

MediaTuna is an ESM CLI (`index.js` orchestrator + `lib/` modules) that batch-converts legacy video and audio to MP4/MP3 via ffmpeg, with NVENC, deinterlacing, metadata preservation, preflight tables, progress bars, `--resume`, `--jobs N`, dual-write logging, stamp/dupe/recup helpers, and original cleanup modes. Audio pipeline: [mediatuna.md](./mediatuna.md).

| Area | Implementation today |
|------|----------------------|
| Entry point | `index.js` (CLI + interactive delete / recup / stamp / dupe) |
| Core | `lib/` (`discover`, `probe`, `encode`, `verify`, `run`, `resume-state`, …) |
| CLI parsing | `node:util` `parseArgs` via `buildCliConfig()` |
| Discovery | Flat default; `--recursive`; video + audio globs (combined default) |
| Encode | Sequential per file; `--jobs N` across files (NVENC-aware) |
| Progress | `cli-progress` MultiBar + ETA; dry-run `[n/total]` text |
| Logging | cwd run log + `~/.mediatuna/history.log` (dual-write) |
| Originals | `--delete-originals` (after convert); `--cleanup-originals` (post-hoc) |

---

## 2. Bug Fixes

Issues are ordered by severity (P0 = should fix soon).

### P0 — Correctness & safety

| ID | Status | Issue | Evidence | Proposed fix |
|----|--------|-------|----------|--------------|
| BF-01 | ✅ | **README vs code mismatch on recursion** | README says “recursive by default” and documents `--flat`; code only recurses with `--recursive` and has no `--flat` | Pick one behavior, align README and code. Recommendation: **flat by default**, opt-in `--recursive` (safer for large archives). Add `--flat` as alias for non-recursive if keeping README wording. |
| BF-02 | ✅ | **Duplicate files in recursive mode** | `files = [...files, ...recFiles]` merges flat scan + glob without deduplication | Deduplicate with `Set` on resolved absolute paths before processing. |
| BF-03 | ✅ | **Log file location surprises global installs** | `LOG_FILE` is `path.dirname(process.argv[1])` — when installed via global link, logs land in the repo/install dir, not the folder being converted | Default log to **cwd** or a `--log <path>` flag; mirror to `~/.mediatuna/history.log`. Document clearly. |
| BF-04 | ✅ | **Stale global binary** | User ran `vidtuna --dry-run` but ffmpeg still executed; header lacked `\| DRY-RUN` | Add `--version` printing package version + script path. Document `npm link` / reinstall in README. |
| BF-05 | ✅ | **No upfront dependency check** | Missing ffmpeg/ffprobe fails mid-batch with opaque errors | On startup, verify `ffmpeg` and `ffprobe` are on PATH; exit non-zero with actionable message if not. |
| BF-06 | ✅ | **No meaningful exit codes** | `process.exit(0)` even when failures occur; CI/automation can't detect partial failure | Exit `1` if any file failed; `0` only on full success. Optional: `2` for usage/dependency errors. |

### P1 — Robustness

| ID | Status | Issue | Evidence | Proposed fix |
|----|--------|-------|----------|--------------|
| BF-07 | ✅ | **Corrupt/unreadable files attempted after probe gap** | Partially addressed: `meta.valid` skips before encode. Files with video stream but `duration: 0` still encode with no progress bar | Treat `duration <= 0` after successful probe as warning; still encode but show indeterminate progress or derive duration from stream/frame count. Log `[WARN] zero duration`. |
| BF-08 | ✅ | **ffmpeg stderr floods error messages** | `err.message` can include full ffmpeg banner (seen in user session) | Parse stderr for last meaningful line, or use `-hide_banner -loglevel error` on ffmpeg args. Log full stderr to file only. |
| BF-09 | ✅ | **No SIGINT / graceful cancel** | Ctrl+C may leave cursor hidden or orphan ffmpeg | Register SIGINT handler: kill active ffmpeg child, call `multibar.stop()`, restore TTY, exit 130. |
| BF-10 | ✅ | **Windows path edge cases in PowerShell metadata copy** | Single-quoted paths break on `$`, newlines, etc. | Use `-LiteralPath` with escaped arguments, or `spawn` with argument array instead of inline PowerShell string. |
| BF-11 | ✅ | **Extension check inconsistent** | Single-file mode accepts any path that exists; folder mode filters extensions | Apply same extension allowlist (or ffprobe validation) in single-file mode. |
| BF-12 | ✅ | **Case-sensitive extension set is redundant** | `getFlatFiles` uses a Set with both `.avi` and `.AVI`; `path.extname` on Windows is typically lowercase | Normalize with `ext.toLowerCase()` and maintain one canonical list. |
| BF-13 | — | **`getMetadata` is async but fully synchronous inside** | Misleading signature; blocks event loop per file | Either make truly async (`execFile` promisified) or rename to `getMetadataSync` and drop async. |
| BF-14 | ✅ | **Dry-run has no batch progress** | `overallBar` is disabled when `dryRun` is true, so no file N/M feedback during preview | Use text-only counter in dry-run (`[3/15]`) or lightweight overall bar without ffmpeg. |
| BF-15 | ✅ | **Partial output on failed encode** | ffmpeg `-n` prevents overwrite, but failed runs may leave zero-byte or partial `.mp4` depending on failure point | On encode failure, delete incomplete output if present (opt-out via `--keep-partial`). |

### P2 — Polish

| ID | Status | Issue | Proposed fix |
|----|--------|-------|--------------|
| BF-16 | ✅ | Unknown flags silently ignored | Warn on unrecognized `--foo` args; add `--help`. |
| BF-17 | ✅ | `--quality=foo` invalid values fall through to medium silently | Validate enum; error on unknown preset. |
| BF-18 | ✅ | `--output` without value uses next argv blindly | Validate `--output` has a following non-flag path. |
| BF-19 | ✅ | Summary says “converted” in dry-run | Already partially fixed with `(dry-run)` label; use “would convert” in dry-run summary counts. |
| BF-20 | ✅ | Progress bar lacks ETA | Add `{eta_formatted}` to current-file bar format (cli-progress built-in). |

---

## 3. Feature Suggestions

Grouped by theme. Priority is suggested, not binding.

### 3.1 CLI & UX

| ID | Status | Feature | Rationale | Priority |
|----|--------|---------|-----------|----------|
| FE-01 | ✅ | **`--help` / `--version`** | Discoverability; debug install path issues | High |
| FE-02 | ✅ | **Structured CLI parser** (e.g. `util.parseArgs` or minimal custom) | Eliminates flag-order bugs; enables `--` separator, short flags | High |
| FE-03 | ✅ | **`--log <file>`** | User-controlled log destination per run | Medium |
| FE-04 | partial | **`--quiet` / `--verbose`** | Quiet = errors + summary only; verbose = ffmpeg command line per file | Medium |
| FE-05 | — | **`--json` summary** | Machine-readable final report for scripts | Low |
| FE-06 | ✅ | **Pre-flight summary table** | After dry-run or scan: columns for name, duration, status (exists/unreadable/convert), size | Medium |
| FE-07 | — | **Confirm before encode** | `--yes` to skip “Convert 12 files? [y/N]” for interactive safety | Low |

### 3.2 Video pipeline

| ID | Status | Feature | Rationale | Priority |
|----|--------|---------|-----------|----------|
| FE-10 | ✅ | **Smart deinterlace** | `yadif` on every file can soften progressive footage; detect interlacing (ffprobe field order / idet) or make `--deinterlace auto\|on\|off` | High |
| FE-11 | partial | **Copy timestamps from embedded tags** | DV AVI often has `N/A` creation in container but useful dates in filename or filesystem; optional `--prefer mtime\|tag\|filename` | Medium |
| FE-12 | ✅ | **Preserve more metadata** | Map rotation, language tags, timecode where ffmpeg allows (`-map_metadata 0`, `-metadata:s:v:0`) | Medium |
| FE-13 | — | **Audio handling options** | `--no-audio`, `--audio-copy` when already AAC, normalize volume | Medium |
| FE-14 | — | **HEVC / AV1 output** | `--codec h264\|hevc` for archival vs compatibility | Low |
| FE-15 | — | **Hardware decode** | `-hwaccel cuda` when NVENC path is used (can speed some pipelines) | Low |
| FE-16 | — | **Two-pass or target bitrate** | Optional `--size-target` for fitting DVDs to a budget | Low |
| FE-17 | — | **Per-file ffmpeg preset override** | Config file or `.finetuna.yml` in folder | Low |

### 3.3 Batch & workflow

| ID | Status | Feature | Rationale | Priority |
|----|--------|---------|-----------|----------|
| FE-20 | ✅ | **Resume / skip list** | `.mediatuna-state.json` + `--resume` after interrupt | High |
| FE-21 | ✅ | **Parallel encodes (`--jobs N`)** | NVENC often allows 2–3 sessions; huge win on large archives (with careful progress UI) | Medium |
| FE-22 | — | **Include/exclude globs** | `--include "*.avi"` / `--exclude "*test*"` | Medium |
| FE-23 | — | **Watch folder mode** | `mediatuna watch ./incoming` for ongoing ingest | Low |
| FE-24 | partial | **Move originals after success** | `--archive ./done` moves source only after verified output | Medium |
| FE-25 | ✅ | **Verify output** | Optional ffprobe pass after encode; compare duration ± tolerance | Medium |
| FE-26 | ✅ | **Delete originals after convert** | `--delete-originals` — confirm after encode completes | Medium |
| FE-27 | ✅ | **Cleanup converted originals** | `--cleanup-originals` — delete sources when output exists + verifies | Medium |
| FE-28 | ✅ | **Master log dual-write** | Mirror run log to `~/.mediatuna/history.log` | Medium |

### 3.4 Observability

| ID | Status | Feature | Rationale | Priority |
|----|--------|---------|-----------|----------|
| FE-30 | ✅ | **Per-file log sections** | Start/end markers with ffmpeg command, elapsed encode time, avg speed | Medium |
| FE-31 | ✅ | **Failed-files report file** | Write `mediatuna-failed.txt` listing unreadable/failed paths for retry | Medium |
| FE-32 | partial | **Encode speed in progress bar** | `speed=1.03x` from ffmpeg stderr alongside HH:MM:SS | Low |

### 3.5 Codebase & maintainability

| ID | Status | Feature | Rationale | Priority |
|----|--------|---------|-----------|----------|
| FE-40 | ✅ | **Split monolith** | Core pipeline in `lib/`; `index.js` is CLI + interactive flows. TS filenames were aspirational. | Medium |
| FE-41 | — | **TypeScript migration** | Parked until after hardening; no user-facing value for a public archive tool | Medium |
| FE-42 | partial | **Automated tests** | Unit tests for helpers in `lib/` + argv; integration fixtures pending | High |
| FE-43 | partial | **CI smoke test** | GitHub Action: test, `--version` / `--help` smoke | Medium |

---

## 4. Progress Bar Spec (target behavior)

Document the intended UX so future changes stay consistent.

### Layout

| Mode | Bars shown |
|------|------------|
| Single file | One **Current** bar (encode position in HH:MM:SS) |
| Batch | **Overall** (file count) + **Current** (active file encode position) |
| Dry-run | No bars; optional `[n/total]` text prefix on each line |

### Current file bar format (proposed)

```
Current [{bar}] {percentage}% | {value} / {total} | ETA {eta_formatted} | {filename}
```

- `{value}` / `{total}`: wall-clock duration as `HH:MM:SS` (already implemented via `formatHMSValue`)
- `{eta_formatted}`: remaining encode time (cli-progress default formatter, or custom HH:MM:SS)

### Rules

1. Only **one** current-file bar instance; restart on each file, never stack stopped bars.
2. All status lines during encode go through `multibar.log()`, not raw `console.log`.
3. Unreadable files: no bar update; log and increment overall only.
4. Zero-duration but valid video: show bar with “unknown length” or spin until first `time=` line sets total.

---

## 5. README alignment checklist

When implementing fixes, update README in the same PR:

- [x] Recursion default (`--recursive` vs `--flat`) matches code
- [x] Setup uses `pnpm install` (not bare `npm install glob cli-progress`)
- [x] Document global install: `npm link` and `mediatuna --version`
- [x] Document exit codes once BF-06 lands
- [x] Document log file location (cwd vs install dir) — Phase 2 (BF-03)
- [x] List all supported extensions explicitly
- [x] Note ffmpeg/ffprobe as required system dependencies

---

## 6. Suggested implementation phases

### Phase 1 — Trust & correctness (1–2 days)

BF-01, BF-02, BF-05, BF-06, BF-08, BF-09, BF-16, FE-01, FE-02, BF-04

**Status:** Implemented (2026-06-22)

**Outcome:** CLI behaves as documented; failures are visible; cancel is safe; installs are verifiable.

### Phase 2 — Batch UX (1 day)

BF-03, BF-14, BF-19, BF-20, FE-06, FE-30, FE-31

**Status:** Implemented (2026-06-22)

**Outcome:** Dry-run and real runs give clear, scannable feedback; logs land where users expect.

### Phase 3 — Pipeline quality (2–3 days)

BF-07, BF-10, BF-15, FE-10, FE-12, FE-25

**Status:** Implemented (2026-06-22)

**Outcome:** Fewer bad encodes; better handling of corrupt DV captures and Windows metadata.

### Phase 4 — Power features (user-facing done)

FE-20, FE-21, FE-40, FE-42 (unit), FE-43 — see [partial/phase-4-engineering.md](./partial/phase-4-engineering.md)

**Outcome:** Resume long archives; optional parallelism; `lib/` split; unit tests + CI. **FE-41 TypeScript parked.** Integration fixtures still open (FE-42).

**See also:** [mediatuna.md](./mediatuna.md) — audio extension (M1–M4 shipped).

### Phase 5 — Hardening (unstarted)

See [hardening.md](./hardening.md) (HS-01–HS-52): trash vs unlink, hash before recup delete, disk-space and large-batch confirms, `--archive` / globs / `--sample`.

---

## 7. Open questions

1. ~~**Recursion default:** flat vs recursive~~ — **resolved:** flat default, `--recursive` opt-in.
2. **In-place vs output folder:** Should `--output` mirror subdirectory structure when using `--recursive`?
3. ~~**Original files:** Delete, move, or never touch?~~ — **partially resolved:** `--delete-originals` and `--cleanup-originals` shipped; `--archive` move not built.
4. **Naming collisions:** Two sources mapping to same output basename in recursive mode (different folders) — flatten or preserve tree?
5. **FineTuna relationship:** Is there a shared config/metadata library with FineTuna worth extracting?

**Status key:** ✅ done · — open · in-flight spec in [partial/](./partial/)

---

## 8. References

- Current implementation: `index.js`
- User-reported session: `vidtuna --dry-run` on a DV capture folder — stale global binary, corrupt source, skipped existing MP4s conflated with dry-run
- ffmpeg progress parsing: stderr `time=` tokens; handle `HH:MM:SS.ms` and `MM:SS.ms`
