# M4 — Advanced audio & testing

**Parent spec:** [mediatuna.md](../mediatuna.md) §12 Phase M4, §13 testing  
**Status:** Core M4 shipped (v1.6.0); FLAC / parallel audio deferred

---

## Shipped (v1.6.0)

| Item | Notes |
|------|-------|
| Smart MP3 skip | Preflight `skip (normalized)` when MP3 meets bitrate/tag bar (`lib/audio-policy.js`) |
| `--extract-audio` | Optional `.mp3` from video sources in same pass |
| Split quality | `--audio-quality` vs shared `--quality` |
| Unit tests | `pnpm test` — LAME mapping, bitrate floors, normalized MP3 policy |

## Deferred

| Item | Notes |
|------|-------|
| FLAC output | `--format flac` profile for archivists |
| Parallel audio | Lower priority than video NVENC parallelism |

## Open decisions (from parent §14)

- ~~Single `--quality` knob vs split video/audio?~~ — **split via `--audio-quality` (defaults to `--quality`)**
- MP3 only vs also AAC `.m4a`?
- `--accept-lossy` for batch FLAC folders?
- `--output-video` / `--output-audio` separate dirs in combined mode?

## Testing plan (§13)

| Test | Type | Status |
|------|------|--------|
| `lameQuality`, bitrate floors, `isNormalizedMp3` | Unit | ✅ |
| `timeToSeconds`, argv parsing | Unit | Phase 4 |
| Probe fixtures: FLAC, MP3, corrupt WMA | Integration | Phase 4 |
| Metadata round-trip: title/artist/album/date | Integration | Phase 4 |
| Album art byte compare | Integration | Phase 4 |
| Lossy warning in preflight | Snapshot CLI | Phase 4 |
| Skip normalized MP3 | Integration | Phase 4 |
| Combined mode dry-run | Snapshot CLI | Phase 4 |

Fixture media must be **synthetic or royalty-free**.
