# Hardening & safety pass

**Status:** In flight (v1.18.0) — public-safety + regret-reducers shipped; HEVC / AAC copy still open  
**Date:** 2026-08-23  
**Scope:** Make destructive and “looks the same” paths harder to regret; close gaps other batch converters already have.

When remaining items ship, fold IDs into [improvements.md](../improvements.md) and delete this file.

---

## 1. How exact is a “match” today?

Nothing in MediaTuna compares **encoded video/audio bitstreams**. “Same file” always means **filesystem metadata**, optional **whole-file SHA-256**, or **playback duration** — never a frame-accurate or PCM compare.

| Path | What is compared | Byte-identical content? | Used to delete? |
|------|------------------|-------------------------|-----------------|
| `--dupe-report` name+size | Basename + `stat.size` (Everything) | **No** — two different files can share a name and size | No (report only) |
| `--dupe-report` size-only | `stat.size` + **same extension** | **No** | No |
| `--dupe-report --hash` | SHA-256 of the **entire file bytes** | **Yes** (content of that file, not “same encode”) | No |
| `--recup-map` placement | Size + extension, then **path score** | **No** | No (`--apply` **copies**) |
| `--recup-map --cleanup-originals` | SHA-256 of recup file vs file in `proposed-tree/` | **Yes** (whole file) | **Yes** |
| Convert `skip (exists)` | Output **path exists** | **No** | No |
| Post-encode `--verify` | Duration within `max(2s, 5% of source)` + type | **No** | Indirect (gates `--delete-originals`) |
| `--resume` | State list + that same verify | **No** | No |
| Convert `--cleanup-originals` | `skip (exists)` + verify duration | **No** | **Yes** |

`--hash` is the only opt-in content-exact check for reports and recup `--apply`. Recup `--cleanup-originals` always hashes before a delete.

SHA-256 equal ⇒ those two files are the same bytes on disk. It does **not** mean “same movie after a remux” or “same song after a re-tag.”

---

## 2. Current safety posture (what already helps)

- Default convert **does not delete** sources.
- `--dry-run` previews convert, stamp, dupe-report, recup-map, and cleanup.
- Deletes require an interactive TTY, `[y/N]`, then typing `DELETE`.
- `--delete-originals` / convert `--cleanup-originals` refuse `--no-verify`.
- ffmpeg is spawned with an argument array (not a shell string).
- Failed encodes remove the partial output unless `--keep-partial`.
- `--resume` requires verify.

---

## 3. Issues to harden

Each item is something that can lose data, write the wrong file, or surprise a first-time run. Priority is “fix before treating this as a public default,” not “nice GUI.”

### 3.1 Destructive / irreversible

| ID | Severity | Issue | Today | Target |
|----|----------|-------|-------|--------|
| HS-01 | ✅ | **Deletes bypass Recycle Bin** | `fs.unlinkSync` | Prefer OS trash (`--trash`, default for deletes). Keep `--delete-permanent` (or type `DELETE`) for true unlink. |
| HS-02 | ✅ | **Recup cleanup is size-only** | Same `stat.size` ⇒ eligible to delete recup source | Require **SHA-256 match** (or `--hash`) before recup delete. Size-only is report-only. |
| HS-03 | ✅ | **`--force` overwrites outputs** | Existing MP4/MP3 replaced | Confirm when TTY and count > 1; always log paths. Never combine `--force` with delete in one argv (already partly restricted). |
| HS-04 | ✅ | **`--stamp-dates` renames in place** | Sources renamed; `--backup` optional | Warn if `--backup` omitted and count > N; dry-run default hint in help. |
| HS-05 | ✅ | **In-place convert is the default** | Writes next to sources in **cwd** | Startup line: “writing N files beside sources in \<dir\>.” Optional `--require-output` / config for nervous archives. |
| HS-06 | ✅ | **`--recursive` on the wrong tree** | Encodes (and later deletes) everything under the path | If discovered count > threshold (e.g. 50), print count + root and require Enter / `--yes` when TTY. |
| HS-07 | ✅ | **No free-space preflight** | Can fill the disk mid-batch | Estimate output from source sizes × factor; abort or warn if destination volume is short. |
| HS-08 | ✅ | **Failed output removed by default** | Useful after a crash if you wanted the stub | Keep default; document. Optional `--keep-partial` already exists. |

### 3.2 Wrong-file / false “same”

| ID | Severity | Issue | Today | Target |
|----|----------|-------|-------|--------|
| HS-10 | ✅ | **Recup `--apply` copies from size+path score** | Wrong gold copy ⇒ wrong folder | `--apply` refuses ambiguous rows (already). Add optional `--hash` to confirm the scored copy is byte-identical before copy. Mark size-only placements in the report. |
| HS-11 | P1 | **Convert cleanup trusts duration, not bytes** | A short/wrong MP4 that still passes ±5% can unlock delete | Keep duration gate. Add optional `--hash-source-pair` later; not required if delete stays confirm-heavy. |
| HS-12 | ✅ | **`skip (exists)` is path-only** | Any file at `clip.mp4` skips, even empty/wrong | If size is 0 or probe fails, do not skip (treat as convert / fail). |
| HS-13 | ✅ | **Name+size dupes look like certainty** | Report heading is easy to over-read | Label sections: “same name and size (not hashed)” vs “SHA-256 match.” |

### 3.3 Quality / one-way loss

| ID | Severity | Issue | Today | Target |
|----|----------|-------|-------|--------|
| HS-20 | ✅ | **Lossy encode is silent except FLAC-style warn** | AVI→H.264 / WMA→MP3 is the product | One preflight banner: “outputs are lossy; keep sources until you have checked playback.” |
| HS-21 | P1 | **`--force` re-encodes already-converted files** | Generation loss | If source is already MP4/MP3 meeting bar, `--force` still needs the same banner / extra confirm when TTY. |
| HS-22 | ✅ | **`--no-verify` can mark a bad file “done”** | Resume/delete blocked with `--no-verify`; convert still writes | Keep delete blocked. Log a loud warning that outputs are unchecked. |
| HS-23 | ✅ | **No sample encode** | First feedback is a full file | `--sample 30` encodes first N seconds to `--output` (or a temp) for a quality check. Common in HandBrake / Shutter. |

### 3.4 Privacy, timestamps, machine cost

| ID | Severity | Issue | Today | Target |
|----|----------|-------|-------|--------|
| HS-30 | P2 | **Logs contain full paths** | cwd log + `~/.mediatuna/history.log` | Document. Optional `--no-master-log` already. Consider `--redact-paths` (basenames only in console). |
| HS-31 | P2 | **Windows Created rewritten if >30 days after Modified** | Heuristic for copy/move | Log when it fires. `--keep-created` to disable. |
| HS-32 | ✅ | **`--jobs` fills disk and heat faster** | User picks N | Preflight: “N concurrent encodes.” Pair with HS-07. |
| HS-33 | P3 | **No “batch finished” signal** | Watch the terminal | Optional beep / Windows toast when the run ends (other GUIs do this). Low priority. |

---

## 4. Features others have that MediaTuna should likely add

Not a clone of Shutter/HandBrake/Tdarr. Only items that fit **home-archive convert + recover**.

| ID | Feature | Who has it | Why it belongs here | Priority |
|----|---------|------------|---------------------|----------|
| HS-40 | **Move originals after verify** (`--archive <dir>`) | HandBrake “delete/move”, Tdarr | Safer than delete; FE-24 already sketched | ✅ |
| HS-41 | **Include / exclude globs** | Tdarr, ffmpeg-batch, Shutter | Avoid `--recursive` eating `previews/`, `node_modules/` | ✅ |
| HS-42 | **`--output` preserves relative folders** | Most batch GUIs | Recursive in-place flatten collides (open Q in improvements §7.4) | ✅ |
| HS-43 | **Sample / preview encode** | HandBrake, Shutter | See HS-23 | ✅ |
| HS-44 | **Trash instead of unlink** | Desktop converters, File Explorer | See HS-01 | ✅ |
| HS-45 | **Free-space check** | HandBrake, Shutter | See HS-07 | ✅ |
| HS-46 | **Hash-confirm before recup apply/cleanup** | Recovery tools that compare copies | See HS-02, HS-10 | ✅ |
| HS-47 | **Large-batch confirm** | Installers, some CLIs (`-y`) | See HS-06 | ✅ |
| HS-48 | **Audio copy when already AAC** | HandBrake “passthrough” | Avoid re-encoding good audio on video (FE-13) | Medium |
| HS-49 | **`--codec h264\|hevc`** | HandBrake, Tdarr, Shutter | Compatibility vs size; FE-14. Do **after** safety pass | Medium |
| HS-50 | **Hardware decode with NVENC** | Shutter, StaxRip | FE-15; speed only | Low |
| HS-51 | **Watch folder** | Tdarr, Unmanic | FE-23; not needed for a hardening pass | Low |
| HS-52 | **Per-folder config** | Tdarr, many GUIs | FE-17; optional later | Low |

Out of scope for this pass (leave to other tools): GUI, crop/rotate editors, subtitle burn-in, DVD/Blu-ray decrypt, cloud upload, Plex library watchers.

---

## 5. Suggested implementation order

1. **Docs + labels (no behavior change)** — HS-13, HS-20, README “what is a match,” recup report wording.
2. **Stop silent wrong deletes** — HS-02, HS-10 (`--hash` on recup apply/cleanup), HS-12.
3. **Harder to shoot the archive** — HS-01 trash, HS-06 count confirm, HS-07 disk check, HS-05 cwd banner, HS-03 `--force` confirm.
4. **Parity features that reduce regret** — HS-40 `--archive`, HS-41 globs, HS-42 output tree, HS-43 `--sample`.
5. **Encode options** — HS-48, HS-49 after the above.

---

## 6. Testing

| Case | Type |
|------|------|
| Two different files, same size + ext → recup cleanup must **not** delete without hash | Unit ✅ |
| SHA-256 match → cleanup allowed | Unit ✅ |
| Empty existing `.mp4` is not `skip (exists)` | Unit ✅ |
| `--dry-run --cleanup-originals` never unlinks | Integration — still open |
| Disk-space warn when estimate > free (mock `statfs`) | Unit ✅ |
| `--sample 5` writes a short output and does not replace the full source | Unit (path + ffmpeg `-t`) ✅ |
| Trash API vs unlink: `--delete-originals` default path | Unit (mocked exec) ✅ |

Fixture media: synthetic or royalty-free only.

---

## 7. README / help when this ships

- A short **“Same file?”** note: size ≠ bytes; `--hash` is SHA-256 of the whole file; verify is duration only.
- Deletes: trash vs permanent, Recycle Bin language on Windows.
- Recommend `--dry-run` then `--output` on a first archive.
- Document `--sample`, `--archive`, `--include` / `--exclude` when they exist.
