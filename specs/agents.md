# Agents (tentative)

**Status:** Decision parked as **skill first**. No MCP server. The CLI stays the only way to encode.

A local agent should be able to *use* MediaTuna — install check, dry-run, sample, convert — so the product is not “learn every flag yourself.” That is judgment plus the existing binary, not a new protocol.

## Decision

| Surface | Do it? | Why |
|---------|--------|-----|
| **Skill** (`skills/mediatuna/SKILL.md`) | Yes — first slice | Teaches dry-run → sample → `--output`. Agent shells out to `mediatuna`. Works in Cursor / Claude Code when the user copies the skill or opens this repo. |
| **Handbook page** | Yes — first slice | [docs/agents.md](../docs/agents.md) so mediatuna.dev says the same thing. |
| **MCP** | Not now | Encodes run for hours. MCP tool calls time out, have no ffmpeg progress, and would re-wrap deletes/confirms that already live in the CLI. ollanet’s MCP fits *small* scan/prompt tools; this is a batch job. |
| **Node library import** | Not now | Home archives are folders, not app embeddings. |

Revisit MCP only if agents need a **read-only** structured dry-run/probe and the CLI table is not enough. Destructive flags stay CLI-only.

## What the skill must enforce

1. Confirm ffmpeg / `mediatuna` on PATH (or `node index.js` from a checkout). Do not invent a raw ffmpeg command line as a replacement.
2. **`--dry-run` first.** Then `--sample` to `--output`, then a full write to `--output`. In-place only after the user has seen a preview.
3. Never `--delete-originals`, `--cleanup-originals`, or `--archive` unless the user asked **and** a restore backup exists.
4. Nothing leaves the machine. Do not upload tapes, logs with paths, or samples to a remote model host beyond what the user’s agent already does.

## First slice (this change)

- Spec + handbook + copyable skill
- README / home / intro mention so the CLI is not the only story

## Later (not scheduled)

- JSON dry-run if agents cannot parse the preflight table
- User-level install helper (“copy this skill to `~/.cursor/skills/mediatuna/`”) as a one-liner in install docs — already described, not automated
- MCP read-only probe — only if a real agent host cannot run the CLI
