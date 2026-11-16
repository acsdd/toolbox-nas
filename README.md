# toolbox-nas

**Status:** `internal_UAT` — under acceptance testing inside the team. ![status](https://img.shields.io/badge/status-internal_UAT-e8c35c?style=flat-square)

Local-first NAS companion daemon: serves the shared [Toolbox widgets](https://github.com/acsdd/toolbox-widgets) — **crypto watch**, **Gmail announcer** and **resource monitor** — over a small web API with a single-page dashboard, and speaks the same portable widget bundle format as the other apps.

Part of the Toolbox family:

| App | Repo |
| --- | --- |
| Toolbox (desktop) | [`toolbox-desktop`](https://github.com/acsdd/toolbox-desktop) |
| MCP server | [`toolbox-mcp`](https://github.com/acsdd/toolbox-mcp) |
| Shared widget core | [`toolbox-widgets`](https://github.com/acsdd/toolbox-widgets) |

## API

| Route | What it does |
| --- | --- |
| `GET /` | Dashboard page |
| `GET /api/overview` | All three widgets at a glance |
| `POST /api/crypto/refresh` · `POST /api/crypto/watchlist` · `GET /api/crypto/series?id&days` | CoinGecko watchlist and price history |
| `GET /api/gmail` · `POST /api/gmail/check` · `POST /api/gmail/connect` · `POST /api/gmail/disconnect` | Read-only Gmail IMAP checks (App Password, 16 chars) |
| `GET /api/system/stats` · `GET /api/system/processes` | CPU / memory / disk and top processes |
| `GET /api/widgets/export` · `POST /api/widgets/import` | Portable widget bundles |

## Run

Requires Node.js 22+. The sibling `toolbox-widgets` repo must be checked out next to this one.

```bash
npm install
npm start          # http://127.0.0.1:3852/
```

Bind address and port come from `TOOLBOX_NAS_HOST` / `TOOLBOX_NAS_PORT`.
The default is localhost-only and there is **no authentication yet** — do not
expose it to a LAN without adding auth first.

Settings live in `~/.toolbox-nas/settings.json` (override with `TOOLBOX_NAS_HOME`),
written owner-readable only (`0600`). **Note:** the Gmail App Password is stored
there until vault integration lands — treat the file as sensitive.

## Development

```bash
npm test           # build + node:test suite (uses fastify.inject, no ports)
npm run typecheck
```

## License

MIT — see [LICENSE](LICENSE).
