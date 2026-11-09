/**
 * Local settings store for toolbox-nas.
 *
 * Lives in ~/.toolbox-nas (or %TOOLBOX_NAS_HOME%). The file is written with
 * owner-only permissions. NOTE: the Gmail App Password is stored in this file
 * until a proper vault integration lands — the repo is private and the server
 * binds to localhost by default, but treat the file as sensitive.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import os from 'node:os'

export interface StoredSettings {
  version: 1
  cryptoWatchlist: string[]
  gmail: { email: string; password: string; notifications: boolean } | null
  resource: { diskPath?: string; showProcesses: boolean }
}

const DEFAULTS: StoredSettings = {
  version: 1,
  cryptoWatchlist: ['bitcoin', 'ethereum', 'solana'],
  gmail: null,
  resource: { showProcesses: true }
}

export function configDir(): string {
  return process.env.TOOLBOX_NAS_HOME ?? join(os.homedir(), '.toolbox-nas')
}

export function configPath(): string {
  return join(configDir(), 'settings.json')
}

export async function loadSettings(): Promise<StoredSettings> {
  try {
    const raw = JSON.parse(await readFile(configPath(), 'utf8')) as Partial<StoredSettings>
    return {
      version: 1,
      cryptoWatchlist: Array.isArray(raw.cryptoWatchlist) ? raw.cryptoWatchlist : DEFAULTS.cryptoWatchlist,
      gmail:
        raw.gmail && typeof raw.gmail.email === 'string' && typeof raw.gmail.password === 'string'
          ? {
              email: raw.gmail.email,
              password: raw.gmail.password,
              notifications: raw.gmail.notifications !== false
            }
          : null,
      resource: {
        diskPath: typeof raw.resource?.diskPath === 'string' ? raw.resource.diskPath : undefined,
        showProcesses: raw.resource?.showProcesses !== false
      }
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  const target = configPath()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(settings, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}
