# MediaTuna M3 — combined default mode (completed)

**Status:** Shipped 2026-06-22

---

## Goal

One folder scan processes **both** video → MP4 and audio → MP3 without requiring a mode flag.

## Behavior

| Invocation | Scans | Encodes |
|------------|-------|---------|
| `mediatuna [path]` (default) | Video + audio extensions | MP4 and MP3 side by side |
| `mediatuna --video-only` | Video only | MP4 |
| `mediatuna --audio-only` | Audio only | MP3 |

- Recursive mode unions video and audio globs when both enabled.
- Preflight **Type** column shows `video` or `audio` per file; each file uses the correct pipeline.
- Header shows `video+audio | medium | auto | verify`.

## Also shipped in this release

- **WMV, 3GP, 3G2** added to video extension list.

## Not in M3

- `--output-video` / `--output-audio` split dirs
- Smart skip for already-normalized MP3 (M4)
