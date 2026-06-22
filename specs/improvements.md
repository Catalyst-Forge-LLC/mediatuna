# MediaTuna Improvement Spec

**Status:** Active backlog  
**Last reviewed:** 2026-06-22  
**Scope:** Remaining bug fixes, features, and maintainability work

> Completed work is archived under [completed/](./completed/). VidTuna Phases 1–3, audio M1/M2, M3 combined mode, and workflow flags are shipped.

---

## 1. Current state

Single-file Node.js CLI (`index.js`, ~1200 lines, ESM) batch-converting legacy media:

- **Video → MP4** — NVENC/CPU, deinterlace, verify
- **Audio → MP3** — LAME VBR, art embed, tag warnings
- **Default scan:** both video and audio (`--video-only` / `--audio-only` to restrict)
- **Workflow:** dual-write logs, `--delete-originals`, `--cleanup-originals`

| Area | Today |
|------|--------|
| Discovery | Flat default; `--recursive` unions video + audio globs |
| Encode | Sequential ffmpeg per file |
| Logging | cwd run log + `~/.mediatuna/history.log` |
| Tests | None yet |

---

## 2. Open bug fixes

| ID | Issue | Priority |
|----|-------|----------|
| BF-11 | Single-file mode warns but does not enforce extension allowlist | P1 |
| BF-13 | Probe helpers are sync but named/async patterns inconsistent | P2 |
| BF-14 | Dry-run has no `[n/total]` text progress in batch | P2 |

---

## 3. Open features

### High

| ID | Feature |
|----|---------|
| FE-20 | Resume / state file after interrupt (`--resume`) |
| FE-42 | Automated tests (argv, time helpers, probe fixtures) |

### Medium

| ID | Feature |
|----|---------|
| FE-04 | `--quiet` (errors + summary only; `--verbose` exists) |
| FE-21 | Parallel encodes `--jobs N` |
| FE-22 | Include/exclude globs |
| FE-24 | `--archive <dir>` move originals (delete/cleanup exist instead) |
| FE-40 | Split monolith into modules |
| FE-41 | TypeScript migration |
| FE-43 | CI smoke test |

### Low

| ID | Feature |
|----|---------|
| FE-05 | `--json` summary |
| FE-07 | Confirm before encode (`--yes`) |
| FE-14–FE-17 | HEVC/AV1, hw decode, bitrate targets, config file |
| FE-23 | Watch folder mode |
| FE-32 | Encode speed in progress bar |

See [completed/vidtuna-phases-1-3.md](./completed/vidtuna-phases-1-3.md) for the full BF/FE catalog of shipped items.

---

## 4. Phase 4 — Next engineering milestone

FE-20, FE-21, FE-42, FE-40, FE-41, FE-43

**Outcome:** Resumable long archives; optional parallelism; tested, maintainable codebase.

---

## 5. Open questions

1. **`--output` + `--recursive`:** Mirror subdirectory tree under output dir?
2. **Naming collisions:** Same basename in different subfolders when flattening output?
3. **FineTuna:** Shared `.finetuna.yml` config across tools?
4. **Originals policy:** Delete vs move-to-archive — partially answered by `--delete-originals` / `--cleanup-originals` (see [completed/workflow-delete-log.md](./completed/workflow-delete-log.md)).

---

## 6. References

- Implementation: `index.js`
- Product / audio roadmap: [mediatuna.md](./mediatuna.md)
- Shipped milestones: [completed/](./completed/)
