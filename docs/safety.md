# Safety

Dry-run, a preflight table, skip of outputs that already look good, duration verify, Recycle Bin, and extra confirms before destructive flags. Defaults keep sources unless you ask. Skip means `skip (exists)`, `skip (normalized)`, or `skip (resumed)` as in [archive-example.md](./archive-example.md).

That is not a guarantee. Encoding is lossy, “same file” is usually size or duration rather than a bitstream compare, and a wrong path, full disk, or confirmed delete can still lose work. **Keep a local and/or cloud backup you can restore from** before you convert, rename, or clean up an archive. Treat MediaTuna as a tool that sits on top of that backup, not as the backup. `--ledger` records where a new file came from; it is not a substitute for that copy.

More on what “same file” means: [specs/partial/hardening.md](../specs/partial/hardening.md).

## Deletes and originals

- **Deletes** go to Recycle Bin / trash by default. `--delete-permanent` unlinks and still requires typing `DELETE`.
- **`--delete-originals`** — use *while converting*: encode first, then confirm `[y/N]`. Type `DELETE` only with `--delete-permanent`.
- **`--cleanup-originals`** — use *after converting*: `skip (exists)` pairs that verify, then confirm. Preview with `--dry-run --cleanup-originals`. With `--recup-map`, trashes `recup_dir.*` files that already have a SHA-256 match in `proposed-tree/`.
- `--archive` moves sources after verify instead of deleting.

`--yes` skips large-batch, `--force` overwrite, disk-space, and stamp-backup prompts. It never skips the delete confirm.

## Same file?

Size or name+size is not byte-identical. `--hash` is SHA-256 of the **whole file**. Convert `--verify` is duration only (± a few percent). Recup `--cleanup-originals` deletes only on a SHA-256 match.

## Tests

The repo ships an automated suite (`pnpm test`) and GitHub Actions runs it on every push: CLI flag conflicts, skip/verify/resume rules, Recycle Bin vs unlink (mocked), recup SHA-256 cleanup, globs, archive moves, and probe/encode argument builders. When `ffmpeg` / `ffprobe` are on PATH, `pnpm test` also runs a few synthetic encode checks (`--sample`, empty dest, verify, normalized MP3). CI has a second job that installs ffmpeg and runs those.

That is **assurance that the safety rules still mean what we think they mean**, not a certificate that a convert of your files will be perfect. The suite uses generated color/sine clips, not family media, and it does not open your Recycle Bin.

Details and the remaining backlog: [specs/testing.md](../specs/testing.md).

```bash
pnpm test           # unit suite; ffmpeg cases run only if ffmpeg is on PATH
pnpm test:ffmpeg    # synthetic encode checks (requires ffmpeg + ffprobe)
```

## Privacy

MediaTuna does not phone home. Log files may contain full local paths; treat them as private if folder names are sensitive.
