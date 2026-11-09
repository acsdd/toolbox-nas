/**
 * Widget services for toolbox-nas: thin stateful wrappers around
 * @toolbox/widgets with local persistence and the portable bundle format.
 */
import {
  createResourceMonitor,
  fetchGmailInbox,
  fetchMarkets,
  fetchSeries,
  friendlyGmailError,
  normalizeWatchlist,
  parseBundle,
  serializeBundle,
  validateGmailSetup,
  type CryptoCoin,
  type CryptoSeries,
  type FetchLike,
  type GmailCheckResult,
  type ResourceStats,
  type TopProcess,
  type WidgetBundleEntry
} from '@toolbox/widgets'
import { loadSettings, saveSettings, type StoredSettings } from './config.js'

export const USER_AGENT = 'toolbox-nas/0.1.0 (+https://github.com/28121978444/toolbox-nas)'

interface ServicesOptions {
  fetchImpl?: FetchLike
}

export interface CryptoState {
  watchlist: string[]
  coins: CryptoCoin[]
  missing: string[]
  checking: boolean
  lastCheck: number | null
  error: string | null
}

export interface GmailState {
  configured: boolean
  email: string
  lastCheck: number | null
  unread: number
  messages: GmailCheckResult['messages']
  error: string | null
}

export function createServices(options: ServicesOptions = {}) {
  const fetchOptions = { userAgent: USER_AGENT, fetchImpl: options.fetchImpl }
  const settings: { current: StoredSettings } = {
    current: {
      version: 1,
      cryptoWatchlist: ['bitcoin', 'ethereum', 'solana'],
      gmail: null,
      resource: { showProcesses: true }
    }
  }
  const crypto: CryptoState = {
    watchlist: [],
    coins: [],
    missing: [],
    checking: false,
    lastCheck: null,
    error: null
  }
  let gmail: GmailState = {
    configured: false,
    email: '',
    lastCheck: null,
    unread: 0,
    messages: [],
    error: null
  }
  let monitor = createResourceMonitor({})

  async function init(): Promise<void> {
    settings.current = await loadSettings()
    crypto.watchlist = normalizeWatchlist(settings.current.cryptoWatchlist)
    monitor = createResourceMonitor({ diskPath: settings.current.resource.diskPath })
    gmail = {
      configured: Boolean(settings.current.gmail),
      email: settings.current.gmail?.email ?? '',
      lastCheck: null,
      unread: 0,
      messages: [],
      error: null
    }
  }

  async function cryptoRefresh(): Promise<CryptoState> {
    crypto.checking = true
    crypto.error = null
    try {
      const { coins, missing } = await fetchMarkets(crypto.watchlist, fetchOptions)
      crypto.coins = coins
      crypto.missing = missing
      crypto.lastCheck = Date.now()
    } catch (cause) {
      crypto.error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      crypto.checking = false
    }
    return crypto
  }

  async function cryptoSetWatchlist(value: unknown): Promise<CryptoState> {
    crypto.watchlist = normalizeWatchlist(value)
    crypto.coins = []
    settings.current.cryptoWatchlist = [...crypto.watchlist]
    await saveSettings(settings.current)
    return cryptoRefresh()
  }

  async function cryptoSeries(id: unknown, days: unknown): Promise<CryptoSeries> {
    return fetchSeries(id, days, fetchOptions)
  }

  async function gmailConnect(input: unknown): Promise<GmailState> {
    const setup = validateGmailSetup(input)
    const result = await fetchGmailInbox(setup.email, setup.password).catch((cause) => {
      throw new Error(friendlyGmailError(cause))
    })
    settings.current.gmail = { ...setup, notifications: true }
    await saveSettings(settings.current)
    gmail = {
      configured: true,
      email: setup.email,
      lastCheck: Date.now(),
      unread: result.unread,
      messages: result.messages,
      error: null
    }
    return gmail
  }

  async function gmailDisconnect(): Promise<GmailState> {
    settings.current.gmail = null
    await saveSettings(settings.current)
    gmail = { configured: false, email: '', lastCheck: null, unread: 0, messages: [], error: null }
    return gmail
  }

  async function gmailCheck(): Promise<GmailState> {
    const account = settings.current.gmail
    if (!account) {
      gmail.error = 'Gmail is not connected. Connect with an App Password first.'
      return gmail
    }
    try {
      const result = await fetchGmailInbox(account.email, account.password)
      gmail = {
        configured: true,
        email: account.email,
        lastCheck: Date.now(),
        unread: result.unread,
        messages: result.messages,
        error: null
      }
    } catch (cause) {
      gmail.error = friendlyGmailError(cause)
    }
    return gmail
  }

  async function resourceStats(): Promise<ResourceStats> {
    return monitor.getStats()
  }

  async function resourceProcesses(): Promise<TopProcess[]> {
    if (!settings.current.resource.showProcesses) return []
    return monitor.getTopProcesses()
  }

  /** Export the current widget setup as a portable bundle (JSON string). */
  async function exportWidgets(): Promise<string> {
    const entries: WidgetBundleEntry[] = [
      { widget: 'crypto-watch', settings: { watchlist: [...crypto.watchlist] } },
      ...(settings.current.gmail
        ? [
            {
              widget: 'gmail-announcer' as const,
              settings: {
                email: settings.current.gmail.email,
                notifications: settings.current.gmail.notifications
              },
              credentialsRef: 'gmail/app-password'
            }
          ]
        : []),
      {
        widget: 'resource-monitor',
        settings: {
          ...(settings.current.resource.diskPath
            ? { diskPath: settings.current.resource.diskPath }
            : {}),
          showProcesses: settings.current.resource.showProcesses
        }
      }
    ]
    return serializeBundle(entries)
  }

  /**
   * Import a portable bundle. Widget settings are applied; credential
   * references are reported back so the caller can wire up local secrets.
   */
  async function importWidgets(value: unknown): Promise<{ applied: string[]; missingCredentials: string[] }> {
    const bundle = parseBundle(value)
    const applied: string[] = []
    const missingCredentials: string[] = []

    for (const entry of bundle.widgets) {
      switch (entry.widget) {
        case 'crypto-watch':
          await cryptoSetWatchlist((entry.settings as { watchlist: string[] }).watchlist)
          applied.push('crypto-watch')
          break
        case 'resource-monitor': {
          const resource = entry.settings as { diskPath?: string; showProcesses?: boolean }
          settings.current.resource = {
            diskPath: resource.diskPath,
            showProcesses: resource.showProcesses !== false
          }
          monitor = createResourceMonitor({ diskPath: resource.diskPath })
          await saveSettings(settings.current)
          applied.push('resource-monitor')
          break
        }
        case 'gmail-announcer':
          // Settings are kept, but the App Password must exist locally.
          settings.current.gmail = null
          await saveSettings(settings.current)
          gmail = { configured: false, email: '', lastCheck: null, unread: 0, messages: [], error: null }
          missingCredentials.push(entry.credentialsRef ?? 'gmail/app-password')
          applied.push('gmail-announcer')
          break
      }
    }
    return { applied, missingCredentials }
  }

  return {
    init,
    get crypto() {
      return crypto
    },
    get gmail() {
      return gmail
    },
    cryptoRefresh,
    cryptoSetWatchlist,
    cryptoSeries,
    gmailConnect,
    gmailDisconnect,
    gmailCheck,
    resourceStats,
    resourceProcesses,
    exportWidgets,
    importWidgets
  }
}

export type Services = ReturnType<typeof createServices>
