# VidTuna / MediaTuna Phases 1–3 (completed)

**Status:** Shipped 2026-06-22  
**Archived from:** [improvements.md](../improvements.md)

---

## Phase 1 — Trust & correctness

BF-01, BF-02, BF-05, BF-06, BF-08, BF-09, BF-16, FE-01, FE-02, BF-04

- Flat-by-default recursion; `--recursive` / `--flat`
- Deduped file discovery
- ffmpeg/ffprobe startup check; exit codes 0/1/2/130
- Parsed ffmpeg stderr; SIGINT cleanup
- Strict CLI via `parseArgs`; `--help` / `--version`
- Global install documented (`npm link`)

## Phase 2 — Batch UX

BF-03, BF-14, BF-19, BF-20, FE-06, FE-30, FE-31

- Run log defaults to cwd; `--log <file>`
- Preflight table (duration, size, status)
- Progress bars with ETA; per-file log sections
- `mediatuna-failed.txt` on failures
- Dry-run summary uses “would convert”

## Phase 3 — Pipeline quality

BF-07, BF-10, BF-15, FE-10, FE-12, FE-25

- Zero-duration warning; incomplete output removal (`--keep-partial`)
- Windows timestamp copy via JSON-escaped PowerShell paths
- `--deinterlace auto|on|off` with field-order detection
- `-map_metadata 0`; post-encode ffprobe verify (`--no-verify` opt-out)
