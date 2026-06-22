# M4 — Advanced audio & testing (in flight)

**Parent spec:** [mediatuna.md](../mediatuna.md) §12 Phase M4, §13 testing  
**Status:** Not started

---

## Product scope

| Item | Notes |
|------|-------|
| Smart MP3 skip | Preflight `skip (normalized)` when MP3 meets bitrate/tag bar |
| `--extract-audio` | Optional `.mp3` from video sources in same pass |
| Split quality | `--audio-quality` vs shared `--quality` |
| FLAC output | `--format flac` profile for archivists |
| Parallel audio | Lower priority than video NVENC parallelism |

## Open decisions (from parent §14)

- Single `--quality` knob vs split video/audio?
- MP3 only vs also AAC `.m4a`?
- `--accept-lossy` for batch FLAC folders?
- `--output-video` / `--output-audio` separate dirs in combined mode?

## Testing plan (§13)

| Test | Type |
|------|------|
| `timeToSeconds`, argv parsing | Unit |
| Probe fixtures: FLAC, MP3, corrupt WMA | Integration |
| Metadata round-trip: title/artist/album/date | Integration |
| Album art byte compare | Integration |
| Lossy warning in preflight | Snapshot CLI |
| Skip normalized MP3 | Integration |
| Combined mode dry-run | Snapshot CLI |

Fixture media must be **synthetic or royalty-free**.

## Suggested order

1. Unit tests for helpers + argv (unblocks refactors)
2. Smart MP3 skip (user-visible M4)
3. `--extract-audio`
4. Remaining M4 items
