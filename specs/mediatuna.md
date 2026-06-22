# MediaTuna Extension Spec

**Status:** Active — M4 and testing backlog  
**Depends on:** MediaTuna video + audio pipeline (`index.js`)

**Shipped (archived):** [completed/mediatuna-m1-m2-rebrand.md](./completed/mediatuna-m1-m2-rebrand.md), [completed/mediatuna-m3-combined-mode.md](./completed/mediatuna-m3-combined-mode.md)

---

## 1. Vision

**MediaTuna** batch-converts legacy folders to modern **MP4** and **MP3** in one pass.

| Output | Status |
|--------|--------|
| **MP4** (H.264 + AAC) | Shipped |
| **MP3** (LAME VBR) | Shipped |

Default: `mediatuna ./archive` scans and converts **both** media types. Use `--video-only` or `--audio-only` to restrict.

---

## 2. CLI modes (current)

```bash
mediatuna ./archive              # video + audio (default)
mediatuna ./music --audio-only
mediatuna ./tapes --video-only
mediatuna ./archive --cleanup-originals   # post-conversion source cleanup
```

See [completed/workflow-delete-log.md](./completed/workflow-delete-log.md) for delete/cleanup and logging.

---

## 3. Phase M4 — Advanced (next product work)

| Item | Description |
|------|-------------|
| Smart MP3 skip | Skip `[already normalized]` when MP3 meets quality bar |
| `--extract-audio` | Also write `.mp3` from video sources |
| Split quality | `--audio-quality` vs `--quality` |
| FLAC output | `--format flac` for archivists |
| Parallel audio | Lower priority than video NVENC parallelism |

---

## 4. Open questions

1. **Single `--quality` knob** for both types, or split video/audio?
2. **MP3 only**, or also **AAC `.m4a`** for Apple ecosystem?
3. **Extract audio from video** in same pass — desirable for DV tapes?
4. **WMA/DRM** — fail fast or attempt decode?
5. **FineTuna integration** — shared config file?
6. **Lossy policy** — warn vs require `--accept-lossy` for FLAC batches?
7. **`--output-video` / `--output-audio`** — separate output dirs in combined mode?

---

## 5. Testing strategy (not started)

| Test | Type |
|------|------|
| `timeToSeconds`, argv parsing | Unit |
| Probe fixtures: FLAC, MP3, corrupt WMA | Integration |
| Metadata round-trip | Integration |
| Album art byte compare | Integration |
| Lossy warning in preflight | Snapshot CLI |
| Combined mode dry-run | Snapshot CLI |

Fixture media must be synthetic or royalty-free.

---

## 6. References

- Video backlog: [improvements.md](./improvements.md)
- Shipped phases: [completed/](./completed/)
- ffmpeg LAME VBR: `-q:a` 0 (best) … 9 (smallest)
