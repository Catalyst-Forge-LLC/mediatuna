# Workflow: logging & original cleanup (completed)

**Status:** Shipped 2026-06-22

---

## Dual-write logging

| Log | Default path |
|-----|----------------|
| Run log | `./mediatuna-log.txt` in cwd (override: `--log`) |
| Master log | `~/.mediatuna/history.log` (override: `--master-log`; disable: `--no-master-log`) |

Every log line is appended to both files.

## `--delete-originals`

Use **during** a conversion run:

1. Encodes all files (no delete prompt upfront)
2. Summary: `MediaTuna Complete`
3. Lists sources that **converted successfully**
4. Double confirm: `[y/N]` then type `DELETE`
5. Deletes only those sources

Requires verify (no `--no-verify`). Failed/skipped files are never deleted.

## `--cleanup-originals`

Use **after** conversion, when outputs already exist:

1. Finds `skip (exists)` pairs
2. Verifies each output (duration, stream)
3. Double confirm with full path list
4. Deletes sources only; keeps MP4/MP3

Preview: `--dry-run --cleanup-originals`

## Global CLI

Documented install path: `npm link` from repo root (not `pnpm link -g`).
