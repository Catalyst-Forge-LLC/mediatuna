# mediatuna.dev

Marketing + notes site for [MediaTuna](https://github.com/Catalyst-Forge-LLC/mediatuna), built with [FilePress](https://getfilepress.com) ([`getfilepress`](https://www.npmjs.com/package/getfilepress) on npm).

```bash
pnpm install
pnpm dev          # local preview
pnpm build        # → build/
```

From the package root: `pnpm site:dev` / `pnpm site:build` / `pnpm ship`. Live target: [mediatuna.dev](https://mediatuna.dev).

If [LocalSlip](https://www.npmjs.com/package/localslip) is installed, this site stays on **5197** as `mediatuna-site`.

## Deploy (Cloudflare Pages)

**Use one pipeline only.** Dual deploys overwrite each other when asset hashes disagree.

```bash
pnpm ship
# = pnpm build && wrangler pages deploy build --project-name=mediatuna
```

Then attach **mediatuna.dev** in the Cloudflare dashboard.

### Git-connected Pages

| Setting | Value |
|---|---|
| Root directory | `site` |
| Build command | `pnpm install && pnpm build` |
| Output directory | `build` |
| Node | 20+ |

Dependency is the public npm package:

```json
"getfilepress": "^0.1.8"
```

## Content sync

**Site** = product narrative (home, Install, posts). **Repo `docs/`** = the handbook; `site/scripts/build-docs.mjs` compiles it to `/docs`. When behavior changes, update `docs/*` and the matching product page.
