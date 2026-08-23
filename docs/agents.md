# Agents

MediaTuna is a local CLI. Your **local agent** (Cursor, Claude Code, and the like) can run it for you. You do not have to memorize the flag list.

The agent should call `mediatuna`, not invent an ffmpeg command line. It should not upload your tapes.

## What to ask

```
Dry-run this folder with MediaTuna, then show me the preflight table.
```

```
Sample 20 seconds of the camcorder pile into ./samples, then stop.
```

```
Convert ./archives/tapes to ./converted. Do not delete originals.
```

Keep a backup you can restore. Preview, then write somewhere other than the source folder. Same sequence as [Usage](./usage.md).

## Skill

Copy [`skills/mediatuna/SKILL.md`](../skills/mediatuna/SKILL.md) into your agent’s skills folder (for Cursor: `~/.cursor/skills/mediatuna/SKILL.md`). That file is the install-and-safety checklist: dry-run first, sample before a full write, no deletes unless you ask.

If you already have this repo open in Cursor, point the agent at that skill or at this page.

## Not an MCP server

Long encodes and delete confirms stay in the CLI. There is no `mediatuna mcp`. A skill plus the binary is the agent surface. Spec: [specs/agents.md](../specs/agents.md).
