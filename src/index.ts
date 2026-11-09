#!/usr/bin/env node
/**
 * toolbox-nas entry point: starts the web app on localhost.
 * TOOLBOX_NAS_HOST / TOOLBOX_NAS_PORT override the bind address and port.
 * Defaults bind to 127.0.0.1 — set TOOLBOX_NAS_HOST to a LAN address only if
 * you understand the exposure (no auth yet).
 */
import { createServices } from './services.js'
import { buildApp } from './server.js'

const host = process.env.TOOLBOX_NAS_HOST ?? '127.0.0.1'
const port = Number(process.env.TOOLBOX_NAS_PORT ?? 3852)

const services = createServices()
await services.init()

const app = buildApp(services)
await app.listen({ host, port })
console.log(`toolbox-nas ready: http://${host}:${port}/`)
