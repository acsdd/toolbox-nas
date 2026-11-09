import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createServices } from '../dist/services.js'
import { buildApp } from '../dist/server.js'

let home = ''

before(async () => {
  home = await mkdtemp(join(tmpdir(), 'toolbox-nas-test-'))
  process.env.TOOLBOX_NAS_HOME = home
})

after(async () => {
  delete process.env.TOOLBOX_NAS_HOME
  await rm(home, { recursive: true, force: true })
})

function fakeFetch(payload: unknown) {
  return async () => new Response(JSON.stringify(payload), { status: 200 })
}

async function buildTestApp() {
  const services = createServices({
    fetchImpl: fakeFetch([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000 }])
  })
  await services.init()
  const app = buildApp(services)
  return { services, app }
}

describe('web api', () => {
  it('serves the dashboard page', async () => {
    const { app } = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/' })
    assert.equal(res.statusCode, 200)
    assert.match(res.body, /toolbox-nas/)
    await app.close()
  })

  it('returns an overview with all three widgets', async () => {
    const { app } = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/overview' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('crypto' in body && 'gmail' in body && 'resource' in body)
    assert.equal(body.crypto.watchlist.length, 3)
    assert.ok(body.resource.cores > 0)
    await app.close()
  })

  it('refreshes crypto prices', async () => {
    const { app } = await buildTestApp()
    const res = await app.inject({ method: 'POST', url: '/api/crypto/refresh' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().coins[0].price, 60000)
    await app.close()
  })

  it('updates the watchlist', async () => {
    const { app } = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/crypto/watchlist',
      payload: { watchlist: ['bitcoin'] }
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().watchlist, ['bitcoin'])
    await app.close()
  })

  it('rejects an empty watchlist', async () => {
    const { app } = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/crypto/watchlist',
      payload: { watchlist: [] }
    })
    assert.equal(res.statusCode, 500)
    await app.close()
  })

  it('round-trips a widget bundle through export/import', async () => {
    const { app } = await buildTestApp()
    const exported = await app.inject({ method: 'GET', url: '/api/widgets/export' })
    assert.equal(exported.statusCode, 200)
    const bundle = exported.json()
    assert.equal(bundle.format, 'toolbox-widgets')

    const imported = await app.inject({
      method: 'POST',
      url: '/api/widgets/import',
      payload: bundle
    })
    assert.equal(imported.statusCode, 200)
    assert.deepEqual(imported.json().applied.sort(), ['crypto-watch', 'resource-monitor'])
    await app.close()
  })

  it('rejects a malformed bundle', async () => {
    const { app } = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/widgets/import',
      payload: { format: 'nope' }
    })
    assert.equal(res.statusCode, 500)
    await app.close()
  })
})
