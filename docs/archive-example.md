---
title: Archive example
---

Fictional shelf. Do not point this at a real family archive. Names are generated.

## Before

```text
archives/sample-shelf/
  2010-09-24-Recording011.AVI
  16-05-24-17-19-01.MOV
  picnic-clip.wav
  porch-talk.mp3
```

| File | What the tool can establish |
| --- | --- |
| `2010-09-24-Recording011.AVI` | Date from the filename. No clock in the name, so none is invented |
| `16-05-24-17-19-01.MOV` | Known filename encoding. Normalized to `2016-05-24_17-19-01` |
| `picnic-clip.wav` | No date in the name. Embedded `creation_time` is used when ffprobe has it. Otherwise the basename stays |
| `porch-talk.mp3` | Already a normalized MP3. Planned as `skip (normalized)` |

`--prefer-mtime` is a separate choice. It prefixes `MTIME_` so a filesystem time is not presented as a recording time.

## Planned first run

```bash
mediatuna "./archives/sample-shelf" --dry-run --output "./converted"
```

| Source | Planned status | Output under `./converted` |
| --- | --- | --- |
| `2010-09-24-Recording011.AVI` | `convert → mp4` | `2010-09-24-Recording011.mp4` (date-only stem, no invented clock) |
| `16-05-24-17-19-01.MOV` | `convert → mp4` | `2016-05-24_17-19-01.mp4` |
| `picnic-clip.wav` | `convert → mp3` | `YYYY-MM-DD_HH-MM-SSZ_picnic-clip.mp3` only if `creation_time` exists, else `picnic-clip.mp3` |
| `porch-talk.mp3` | `skip (normalized)` | unchanged source |

Recommended next steps after the table looks right:

```bash
mediatuna "./archives/sample-shelf" --sample 20 --output "./samples"
mediatuna "./archives/sample-shelf" --output "./converted"
```

`--sample` writes a short clip. `--output` writes new files beside a copy of the source tree. The originals stay unless you later pass a delete or archive flag and confirm.

## Next run

Same command, same `--output`, same quality flags:

| Source | Next status |
| --- | --- |
| converted video or audio | `skip (exists)` when the dest still probes as a usable MP4 or MP3 |
| `porch-talk.mp3` | `skip (normalized)` |
| `--resume` after an interrupted batch | `skip (resumed)` when that input is marked complete and the dest still verifies |

A new `--output`, `--quality`, `--audio-quality`, `--deinterlace`, `--reencode-audio`, or other run-key change is new work. `--force` bypasses skip and resume.

Encoding is lossy. The new files are access copies, not a perfect archive of the originals.
