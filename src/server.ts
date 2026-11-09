/**
 * toolbox-nas web app: Fastify JSON API + single-page dashboard.
 */
import Fastify, { type FastifyInstance } from 'fastify'
import type { Services } from './services.js'

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>toolbox-nas</title>
<style>
  :root { color-scheme: dark; --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #e6edf3; --muted: #8b949e; --accent: #3fb950; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: var(--muted); font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; margin-top: 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
  .card h2 { font-size: 13px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  pre { white-space: pre-wrap; word-break: break-word; margin: 0; font-size: 12px; max-height: 280px; overflow: auto; }
  button { margin-top: 10px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; background: #21262d; color: var(--text); cursor: pointer; }
  button:hover { border-color: var(--accent); }
  textarea { width: 100%; min-height: 90px; margin-top: 10px; background: #0d1117; color: var(--text); border: 1px solid var(--border); border-radius: 6px; font: 12px/1.4 monospace; }
</style>
</head>
<body>
  <h1>toolbox-nas</h1>
  <div class="muted">NAS companion · shares widgets with Toolbox and toolbox-mcp</div>
  <div class="grid">
    <div class="card"><h2>Crypto watch</h2><pre id="crypto">…</pre><button onclick="act('/api/crypto/refresh', 'crypto')">Refresh prices</button></div>
    <div class="card"><h2>Gmail announcer</h2><pre id="gmail">…</pre><button onclick="act('/api/gmail/check', 'gmail')">Check inbox</button></div>
    <div class="card"><h2>Resource monitor</h2><pre id="resource">…</pre><button onclick="act('/api/system/stats', 'resource')">Refresh stats</button></div>
    <div class="card">
      <h2>Widget bundle</h2>
      <pre id="bundle">…</pre>
      <button onclick="exportBundle()">Export widgets</button>
      <textarea id="importBox" placeholder='Paste a bundle from Toolbox or toolbox-mcp, then press Import'></textarea>
      <button onclick="importBundle()">Import bundle</button>
      <pre id="importResult"></pre>
    </div>
  </div>
<script>
async function act(path, target) {
  const res = await fetch(path, { method: 'POST' })
  document.getElementById(target).textContent = JSON.stringify(await res.json(), null, 2)
}
async function exportBundle() {
  const res = await fetch('/api/widgets/export')
  document.getElementById('bundle').textContent = await res.text()
}
async function importBundle() {
  const raw = document.getElementById('importBox').value
  const res = await fetch('/api/widgets/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw })
  document.getElementById('importResult').textContent = JSON.stringify(await res.json(), null, 2)
}
async function boot() {
  const res = await fetch('/api/overview')
  const data = await res.json()
  document.getElementById('crypto').textContent = JSON.stringify(data.crypto, null, 2)
  document.getElementById('gmail').textContent = JSON.stringify(data.gmail, null, 2)
  document.getElementById('resource').textContent = JSON.stringify(data.resource, null, 2)
  exportBundle()
}
boot()
</script>
</body>
</html>`

export function buildApp(services: Services): FastifyInstance {
  const app = Fastify({ logger: false })

  app.get('/', async (_req, reply) => {
    reply.type('text/html; charset=utf-8')
    return PAGE
  })

  app.get('/api/overview', async () => ({
    crypto: services.crypto,
    gmail: services.gmail,
    resource: await services.resourceStats()
  }))

  // crypto-watch
  app.post('/api/crypto/refresh', async () => services.cryptoRefresh())
  app.post('/api/crypto/watchlist', async (request) =>
    services.cryptoSetWatchlist((request.body as { watchlist?: unknown })?.watchlist)
  )
  app.get('/api/crypto/series', async (request) => {
    const query = request.query as { id?: string; days?: string }
    return services.cryptoSeries(query.id, Number(query.days))
  })

  // gmail-announcer
  app.get('/api/gmail', async () => services.gmail)
  app.post('/api/gmail/check', async () => services.gmailCheck())
  app.post('/api/gmail/connect', async (request) => services.gmailConnect(request.body))
  app.post('/api/gmail/disconnect', async () => services.gmailDisconnect())

  // resource-monitor
  app.get('/api/system/stats', async () => services.resourceStats())
  app.get('/api/system/processes', async () => services.resourceProcesses())

  // portable widgets
  app.get('/api/widgets/export', async (_req, reply) => {
    reply.type('application/json; charset=utf-8')
    return services.exportWidgets()
  })
  app.post('/api/widgets/import', async (request) => services.importWidgets(request.body))

  return app
}
