# VidTuna Improvement Spec

**Status:** Draft  
**Last reviewed:** 2026-06-22  
**Scope:** Bug fixes, UX polish, and feature roadmap for the VidTuna CLI (`index.js`)

---

## 1. Current State

VidTuna is a single-file Node.js CLI that batch-converts legacy home-video formats (AVI, MOV, MOD, VOB, MTS, etc.) to H.264/AAC MP4 via ffmpeg, with optional NVENC GPU encoding, deinterlacing (`yadif`), metadata/timestamp preservation, progress bars, and append-only logging.

| Area | Implementation today |
|------|----------------------|
| Entry point | `index.js` (~254 lines, ESM) |
| CLI parsing | Manual `process.argv` (flags + first positional path) |
| Discovery | Flat folder scan; optional `--recursive` glob |
| Encode | Sequential, one ffmpeg child per file |
| Progress | `cli-progress` MultiBar (overall + current file) |
| Logging | `vidtuna-log.txt` next to installed script + stdout |

---

## 2. Bug Fixes

Issues are ordered by severity (P0 = should fix soon).

### P0 — Correctness & safety

| ID | Issue | Evidence | Proposed fix |
|----|-------|----------|--------------|
| BF-01 | **README vs code mismatch on recursion** | README says “recursive by default” and documents `--flat`; code only recurses with `--recursive` and has no `--flat` | Pick one behavior, align README and code. Recommendation: **flat by default**, opt-in `--recursive` (safer for large archives). Add `--flat` as alias for non-recursive if keeping README wording. |
| BF-02 | **Duplicate files in recursive mode** | `files = [...files, ...recFiles]` merges flat scan + glob without deduplication | Deduplicate with `Set` on resolved absolute paths before processing. |
| BF-03 | **Log file location surprises global installs** | `LOG_FILE` is `path.dirname(process.argv[1])` — when installed via `pnpm link -g`, logs land in the repo/install dir, not the folder being converted | Default log to **cwd** or a `--log <path>` flag; optionally also mirror to install dir. Document clearly. |
| BF-04 | **Stale global binary** | User ran `vidtuna --dry-run` but ffmpeg still executed; header lacked `\| DRY-RUN` | Add `--version` printing package version + script path. Document `pnpm link -g` / reinstall in README. Consider postinstall hint. |
| BF-05 | **No upfront dependency check** | Missing ffmpeg/ffprobe fails mid-batch with opaque errors | On startup, verify `ffmpeg` and `ffprobe` are on PATH; exit non-zero with actionable message if not. |
| BF-06 | **No meaningful exit codes** | `process.exit(0)` even when failures occur; CI/automation can't detect partial failure | Exit `1` if any file failed; `0` only on full success. Optional: `2` for usage/dependency errors. |

### P1 — Robustness

| ID | Issue | Evidence | Proposed fix |
|----|-------|----------|--------------|
| BF-07 | **Corrupt/unreadable files attempted after probe gap** | Partially addressed: `meta.valid` skips before encode. Files with video stream but `duration: 0` still encode with no progress bar | Treat `duration <= 0` after successful probe as warning; still encode but show indeterminate progress or derive duration from stream/frame count. Log `[WARN] zero duration`. |
| BF-08 | **ffmpeg stderr floods error messages** | `err.message` can include full ffmpeg banner (seen in user session) | Parse stderr for last meaningful line, or use `-hide_banner -loglevel error` on ffmpeg args. Log full stderr to file only. |
| BF-09 | **No SIGINT / graceful cancel** | Ctrl+C may leave cursor hidden or orphan ffmpeg | Register SIGINT handler: kill active ffmpeg child, call `multibar.stop()`, restore TTY, exit 130. |
| BF-10 | **Windows path edge cases in PowerShell metadata copy** | Single-quoted paths break on `$`, newlines, etc. | Use `-LiteralPath` with escaped arguments, or `spawn` with argument array instead of inline PowerShell string. |
| BF-11 | **Extension check inconsistent** | Single-file mode accepts any path that exists; folder mode filters extensions | Apply same extension allowlist (or ffprobe validation) in single-file mode. |
| BF-12 | **Case-sensitive extension set is redundant** | `getFlatFiles` uses a Set with both `.avi` and `.AVI`; `path.extname` on Windows is typically lowercase | Normalize with `ext.toLowerCase()` and maintain one canonical list. |
| BF-13 | **`getMetadata` is async but fully synchronous inside** | Misleading signature; blocks event loop per file | Either make truly async (`execFile` promisified) or rename to `getMetadataSync` and drop async. |
| BF-14 | **Dry-run has no batch progress** | `overallBar` is disabled when `dryRun` is true, so no file N/M feedback during preview | Use text-only counter in dry-run (`[3/15]`) or lightweight overall bar without ffmpeg. |
| BF-15 | **Partial output on failed encode** | ffmpeg `-n` prevents overwrite, but failed runs may leave zero-byte or partial `.mp4` depending on failure point | On encode failure, delete incomplete output if present (opt-out via `--keep-partial`). |

### P2 — Polish

| ID | Issue | Proposed fix |
|----|-------|--------------|
| BF-16 | Unknown flags silently ignored | Warn on unrecognized `--foo` args; add `--help`. |
| BF-17 | `--quality=foo` invalid values fall through to medium silently | Validate enum; error on unknown preset. |
| BF-18 | `--output` without value uses next argv blindly | Validate `--output` has a following non-flag path. |
| BF-19 | Summary says “converted” in dry-run | Already partially fixed with `(dry-run)` label; use “would convert” in dry-run summary counts. |
| BF-20 | Progress bar lacks ETA | Add `{eta_formatted}` to current-file bar format (cli-progress built-in). |

---

## 3. Feature Suggestions

Grouped by theme. Priority is suggested, not binding.

### 3.1 CLI & UX

| ID | Feature | Rationale | Priority |
|----|---------|-----------|----------|
| FE-01 | **`--help` / `--version`** | Discoverability; debug install path issues | High |
| FE-02 | **Structured CLI parser** (e.g. `util.parseArgs` or minimal custom) | Eliminates flag-order bugs; enables `--` separator, short flags | High |
| FE-03 | **`--log <file>`** | User-controlled log destination per run | Medium |
| FE-04 | **`--quiet` / `--verbose`** | Quiet = errors + summary only; verbose = ffmpeg command line per file | Medium |
| FE-05 | **`--json` summary** | Machine-readable final report for scripts | Low |
| FE-06 | **Pre-flight summary table** | After dry-run or scan: columns for name, duration, status (exists/unreadable/convert), size | Medium |
| FE-07 | **Confirm before encode** | `--yes` to skip “Convert 12 files? [y/N]” for interactive safety | Low |

### 3.2 Video pipeline

| ID | Feature | Rationale | Priority |
|----|---------|-----------|----------|
| FE-10 | **Smart deinterlace** | `yadif` on every file can soften progressive footage; detect interlacing (ffprobe field order / idet) or make `--deinterlace auto\|on\|off` | High |
| FE-11 | **Copy timestamps from embedded tags** | DV AVI often has `N/A` creation in container but useful dates in filename or filesystem; optional `--prefer mtime\|tag\|filename` | Medium |
| FE-12 | **Preserve more metadata** | Map rotation, language tags, timecode where ffmpeg allows (`-map_metadata 0`, `-metadata:s:v:0`) | Medium |
| FE-13 | **Audio handling options** | `--no-audio`, `--audio-copy` when already AAC, normalize volume | Medium |
| FE-14 | **HEVC / AV1 output** | `--codec h264\|hevc` for archival vs compatibility | Low |
| FE-15 | **Hardware decode** | `-hwaccel cuda` when NVENC path is used (can speed some pipelines) | Low |
| FE-16 | **Two-pass or target bitrate** | Optional `--size-target` for fitting DVDs to a budget | Low |
| FE-17 | **Per-file ffmpeg preset override** | Config file or `.vidtuna.yml` in folder | Low |

### 3.3 Batch & workflow

| ID | Feature | Rationale | Priority |
|----|---------|-----------|----------|
| FE-20 | **Resume / skip list** | Persist completed filenames to `.vidtuna-state.json`; `--resume` after interrupt | High |
| FE-21 | **Parallel encodes (`--jobs N`)** | NVENC often allows 2–3 sessions; huge win on large archives (with careful progress UI) | Medium |
| FE-22 | **Include/exclude globs** | `--include "*.avi"` / `--exclude "*test*"` | Medium |
| FE-23 | **Watch folder mode** | `vidtuna watch ./incoming` for ongoing ingest | Low |
| FE-24 | **Move originals after success** | `--archive ./done` moves source only after verified output | Medium |
| FE-25 | **Verify output** | Optional ffprobe pass after encode; compare duration ± tolerance | Medium |

### 3.4 Observability

| ID | Feature | Rationale | Priority |
|----|---------|-----------|----------|
| FE-30 | **Per-file log sections** | Start/end markers with ffmpeg command, elapsed encode time, avg speed | Medium |
| FE-31 | **Failed-files report file** | Write `vidtuna-failed.txt` listing unreadable/failed paths for retry | Medium |
| FE-32 | **Encode speed in progress bar** | `speed=1.03x` from ffmpeg stderr alongside HH:MM:SS | Low |

### 3.5 Codebase & maintainability

| ID | Feature | Rationale | Priority |
|----|---------|-----------|----------|
| FE-40 | **Split monolith** | Modules: `cli.ts`, `discover.ts`, `probe.ts`, `encode.ts`, `progress.ts`, `log.ts` | Medium |
| FE-41 | **TypeScript migration** | Aligns with project conventions; safer refactors | Medium |
| FE-42 | **Automated tests** | Unit tests for `timeToSeconds`, `secondsToHMS`, argv parsing; integration tests with fixture ffprobe JSON | High |
| FE-43 | **CI smoke test** | GitHub Action: lint, test, dry-run against sample files | Medium |

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
- [x] Document global install: `pnpm link -g` and `vidtuna --version`
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

### Phase 4 — Power features (ongoing)

FE-20, FE-21, FE-42, FE-40, FE-41

**Outcome:** Resume long archives; optional parallelism; maintainable codebase with tests.

**See also:** [mediatuna.md](./mediatuna.md) — audio extension / rebrand spec (not yet implemented).

---

## 7. Open questions

1. **Recursion default:** Should VidTuna mirror README (recursive default) or current code (flat default)? Recursive default is convenient but risky on mixed folders.
2. **In-place vs output folder:** Should `--output` mirror subdirectory structure when using `--recursive`?
3. **Original files:** Delete, move, or never touch after successful convert?
4. **Naming collisions:** Two sources mapping to same output basename in recursive mode (different folders) — flatten or preserve tree?
5. **FineTuna relationship:** Is there a shared config/metadata library with FineTuna worth extracting?

---

## 8. References

- Current implementation: `index.js`
- User-reported session: `vidtuna --dry-run` on DV Capture folder — stale global binary, corrupt `grace_4.avi`, skipped existing MP4s conflated with dry-run
- ffmpeg progress parsing: stderr `time=` tokens; handle `HH:MM:SS.ms` and `MM:SS.ms`
