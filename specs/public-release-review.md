# Public Release Review

**Date:** 2026-06-22  
**Repo:** `Catalyst-Forge-LLC/vidtuna` (public)

This document records what was checked before publishing and actions taken.

---

## Summary

**Safe to publish** after the fixes below. No secrets, credentials, or private keys were found in tracked files.

---

## Checked items

| Item | Status | Notes |
|------|--------|-------|
| Secrets / API keys / tokens | ✅ Clear | No `.env`, credentials, or hardcoded secrets in source |
| `vidtuna-log.txt` | ✅ Ignored | Contains local file paths from dev runs; listed in `.gitignore`, not tracked |
| `vidtuna-failed.txt` | ✅ Ignored | Runtime artifact; in `.gitignore` |
| `node_modules/` | ✅ Ignored | Standard `.gitignore` entry |
| Personal paths in source | ✅ Clear | No hardcoded `E:\`, `/Users/`, or home-directory paths in code |
| Specs / docs examples | ✅ OK | Examples use generic paths (`E:\archives\old video`) — acceptable for docs |
| `package.json` author | 🔧 Fixed | Changed from personal handle to **Catalyst Forge LLC** |
| MIT `LICENSE` file | 🔧 Added | `package.json` declared MIT but no LICENSE file existed |
| Repository metadata | 🔧 Added | `repository`, `bugs`, `homepage` in `package.json` |
| User-generated logs | ⚠️ Local only | Delete or keep `vidtuna-log.txt` locally; never commit |

---

## Privacy considerations

VidTuna is a **local CLI** — it does not phone home or upload data. Users should be aware:

1. **Log files** (`vidtuna-log.txt`, `--log`) record full local paths, filenames, and timestamps. Users converting private home video should treat logs as sensitive if paths reveal personal info.
2. **`vidtuna-failed.txt`** lists absolute paths of failed inputs — same consideration.
3. **Console output** during runs shows basenames only in most cases; logs are more verbose.

Consider documenting this in README (done: logging section notes local-only operation).

---

## Recommended before first public push

- [x] `.gitignore` covers runtime logs and failures list
- [x] `LICENSE` present
- [x] Org name on `package.json` author field
- [ ] Add GitHub repo description and topics (`ffmpeg`, `video`, `cli`, `nvenc`)
- [ ] Optional: `SECURITY.md` with contact for vulnerability reports
- [ ] Optional: GitHub Actions CI (Phase 4)

---

## Files safe to publish

| Path | Purpose |
|------|---------|
| `index.js` | CLI source |
| `package.json` | Package manifest |
| `pnpm-lock.yaml` | Reproducible installs |
| `README.md` | Documentation |
| `LICENSE` | MIT license |
| `specs/improvements.md` | Roadmap / design notes |
| `specs/public-release-review.md` | This review |
| `.gitignore` | Ignore rules |

## Do not publish

| Path | Reason |
|------|--------|
| `vidtuna-log.txt` | Local run history with paths |
| `vidtuna-failed.txt` | Local failure list with paths |
| `node_modules/` | Dependencies (install via pnpm) |

---

## Post-publish maintenance

- Re-run this review if adding config files, CI secrets, or example media
- Never commit sample videos containing identifiable people unless explicitly intended as public fixtures
- Keep `pnpm-lock.yaml` committed for supply-chain reproducibility
