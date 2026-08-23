# Post-publish review (2026-08-23)

**Status:** Capture only. Do not start work from this file until a slice is picked.  
**Source:** Two external reviews after GitHub public + npm `mediatuna` + mediatuna.dev (product-boundary review, then README scan).  
**Related:** [improvements.md](./improvements.md), [agents.md](./agents.md), [partial/hardening.md](./partial/hardening.md)

The first review’s center: **MediaTuna is not an ffmpeg wrapper. It is an archive-normalization workflow** with memory, safety, and provenance. Keep that boundary. Change the few surfaces that are now behind the release. The second review is about the GitHub README: keep the hook and the safe quick start; make Agents and the feature list easier to scan.

---

## 1. Keep forever

Do not “improve” these away.

| Keep | Why the review called it out |
|------|------------------------------|
| Category is **archive normalization**, not library optimization | Tdarr / Unmanic are the ongoing-conformity tools. MediaTuna is the archaeological dig: understand, normalize carefully, be done. |
| One-shot CLI, not a platform | No server, worker cluster, dashboard, scheduler, or Plex integration. [FE-23](./improvements.md) watch-folder stays low / not a product turn. |
| Hardening is care, not a guarantee | Encoding is lossy. Duration verify ≠ bit-identical. Tool sits **on** a restorable backup. `--yes` never skips delete confirm. |
| `pnpm test` is assurance, not a certificate | We tested our behavior. That is not a warranty for someone’s 1997 Christmas tape. |
| Skill + binary, not MCP | Agent calls `mediatuna`. Long encodes and destructive confirms stay in the CLI. [agents.md](./agents.md). |
| Tuna joke, once | “You can't tune a fish…” is the right amount of nonsense. Do not ride it through every heading. |
| Recovery helpers stay in the product | Dupes + PhotoRec rebuild are part of the archive problem (dates, names, folders, “already rescued?”), not a side quest. Do **not** put them in the homepage headline yet. |
| Opening line | “The old files are hard to play, hard to date, and hard to find” is the hook. Do not bury it. |
| Trust before the full run | Dry-run, Recycle Bin, and duration verify stay visible early (lede or Core), not only on Safety. |
| Action-oriented Quick start | Preview → sample → convert, with a restore backup first. Do not replace that sequence with a flag tour. |

Positioning the review would lean into (optional later copy, not a rewrite mandate):

> Make an old personal media archive boring again.

Operationally boring: playable, dated, organized. Not a media-server product.

```text
AVI / MOD / VOB / MTS / MOV / WMA / FLAC / WAV / weird dates / recup_dir.8472
                              ↓
                          MediaTuna
                              ↓
               playable, dated, organized media
```

---

## 2. Do not evolve into

These are explicit anti-goals from the review. They also match items we already parked as low.

| Anti-goal | Already in the repo as |
|-----------|------------------------|
| MediaTuna server / workers / dashboard / scheduler | — (do not add) |
| Plex / library-conformity loop | FE-23 watch folder — keep parked |
| MCP because MCP exists | [agents.md](./agents.md) — skill first |
| Headline = “recovery toolkit” before the convert story is obvious | Recovery stays in README / notes, not the H1 |
| “ffmpeg wrapper” as the pitch | Home already says local workflow. Do not walk that back. |

---

## 3. Change soon (release is ahead of the install story)

| ID | Change | Notes |
|----|--------|-------|
| RV-1 | **Install path is npm first** | Live `/install` and [docs/install.md](../docs/install.md) still lead with clone / `pnpm install` / `npm link`. First path should be `npm install -g mediatuna`. Checkout is the development path. Site description and kicker should match. |
| RV-2 | **Decide whether the npm package ships the skill** | `files` is `index.js` + `lib` only. Fine if the handbook says “copy from the repo.” If the desired path is `npm install -g` then `cp …/skills/mediatuna/SKILL.md ~/.cursor/skills/…`, add `skills/` to `files` and document the copy from the global install location. |
| RV-6 | **Agents gets its own heading** | README had a one-liner stranded above Install. Own `## Agents` after the convert story (not before Install). Still skill + CLI — do not make it the lead. ✅ README + docs intro (v1.21.12). |
| RV-7 | **Split “What you get”** | Long flat list. Group into **Core** (pass, safe defaults, skip/resume, AAC copy) and **Data preservation** (dates, recovery). ✅ README + docs intro (v1.21.12). |

---

## 4. Add when we are ready: a durable archive ledger

The review’s one substantial feature ask. Not a database. A **ledger**.

Today we have pieces that do not answer “where did this MP4 come from?” ten years later:

| Piece | What it is | Gap |
|-------|------------|-----|
| `.mediatuna-state.json` | Resume skip list for one run ([FE-20](./improvements.md)) | Tied to output dir + options, not provenance |
| Run log + `~/.mediatuna/history.log` | Human append-only ([FE-28](./improvements.md)) | Paths and ffmpeg lines; not queryable per file |
| `mediatuna-failed.txt` | Retry list ([FE-31](./improvements.md)) | Failures only |
| `--json` summary ([FE-05](./improvements.md)) | Still open, sketched as a **final report** | One-shot script output, not a lasting archive file |

**RV-3 — Durable archive manifest** (opens when we pick it; FE-05 can be a slice or a leftover)

Suggested names (pick one when implementing): `MEDIATUNA_MANIFEST.json` next to the output tree, or `.mediatuna/archive.json`.

Per source, something in this shape — field list is a sketch, not a schema freeze:

```json
{
  "source": "1998/camcorder/tape3/MOV001.MOD",
  "sourceHash": "...",
  "sourceFormat": "...",
  "sourceDate": "...",
  "dateSource": "filesystem|embedded|filename",
  "action": "transcode",
  "output": "1998/camcorder/tape3/MOV001.mp4",
  "outputHash": "...",
  "verified": true,
  "durationDeltaMs": 12,
  "processedAt": "...",
  "mediatunaVersion": "1.21.11"
}
```

Questions it should still answer in a decade:

- Where did this MP4 come from?
- Which date did MediaTuna choose, and why?
- Was the original verified before it was archived / trashed?
- Which conversion policy / version produced this?
- Have I already processed this byte-identical recovered file under another name?

Constraints if/when it ships:

- Append or upsert; do not require SQLite.
- Hashing is opt-in or post-verify, consistent with [hardening.md](./partial/hardening.md) (“same file” is not a bitstream compare unless `--hash`).
- Must not become a reason to skip the restorable-backup rule.
- Skip / resume / cleanup still key off dest paths; the ledger explains them.

FE-05 (`--json` to stdout / a file at end of run) can land first as a thin export. The ledger is the durable file that accumulates across runs.

---

## 5. Later, maybe (do not start from here)

| ID | Idea | Caution |
|----|------|---------|
| RV-4 | Handbook / README sentence that recovery is part of *archive* work, not a second product | Keep the home H1 on playable files. Widen the headline only if convert + dates are already obvious. |
| RV-5 | Copy pass: “boring again” / archaeology metaphor | Optional. Do not replace “So the files still play.” |
| — | Shared `.finetuna.yml` / FineTuna config ([FE-17](./improvements.md), mediatuna.md §12) | Review noticed the cross-pollination. Still Low. Not this review’s next slice. |

---

## 6. Suggested order

1. **RV-1** — npm-first install (site + handbook). Small, overdue now that the package is public.
2. **RV-2** — ship skill or document “from the repo” as the only path. One decision.
3. **RV-6 / RV-7** — README scan: Agents heading + grouped feature list. ✅ v1.21.12.
4. **RV-3** — ledger, after RV-1/2, likely after or with FE-05.

Do not start a watch-folder, MCP, or dashboard spike off this review.

---

## 7. Pointers

- Safety tone to preserve: [docs/safety.md](../docs/safety.md), README Safety
- Agent boundary: [docs/agents.md](../docs/agents.md), [specs/agents.md](./agents.md)
- Resume / logs / failed list: [docs/notes.md](../docs/notes.md)
- Install surfaces to update for RV-1: [site/pages/install.md](../site/pages/install.md), [docs/install.md](../docs/install.md)
- Pre-publish checklist (older): [public-release-review.md](./public-release-review.md)
