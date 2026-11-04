/**
 * DeepSeek Harness (dsh) plugin: dsh-font-dropdown - Host half.
 *
 * The browser cannot enumerate installed fonts by itself (the Local Font
 * Access API is not available to the packaged shell), so the Host enumerates
 * them with GDI+ through Windows PowerShell and answers one authenticated
 * GET route:
 *
 *   GET /plugins/font-dropdown/fonts  ->  { "fonts": ["Arial", ...], "source": "gdi" }
 *
 * The list is cached briefly so repeated settings renders cost nothing.
 */
import { execFile } from 'node:child_process'

export const name = 'font-dropdown'

export const inject = ['webServer', 'connection']

const ROUTE = '/plugins/font-dropdown/fonts'

/** GDI+ family names, UTF-8 JSON on stdout. */
const SCRIPT = [
  '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Drawing',
  '$f=(New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }',
  'ConvertTo-Json -InputObject @($f) -Compress',
].join('; ')

const CACHE_MS = 60_000

let cache = { at: 0, fonts: null }

function enumerateFonts() {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
      { windowsHide: true, timeout: 20_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        try {
          const parsed = JSON.parse(String(stdout).trim())
          const list = Array.isArray(parsed) ? parsed : [parsed]
          const fonts = [...new Set(
            list
              .filter((item) => typeof item === 'string')
              .map((item) => item.trim())
              .filter((item) => item.length > 0),
          )].sort((a, b) => a.localeCompare(b, 'zh-Hans'))
          resolve(fonts)
        } catch (error) {
          reject(error)
        }
      },
    )
  })
}

async function currentFonts(ctx) {
  const now = Date.now()
  if (cache.fonts !== null && now - cache.at < CACHE_MS) return cache.fonts
  const fonts = await enumerateFonts()
  cache = { at: now, fonts }
  ctx.logger?.debug?.('font-dropdown: %d installed font families', fonts.length)
  return fonts
}

function writeJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    handler: async (req, res) => {
      // The harness web server authenticates per route; when it refuses, it
      // has already written the 401 and owns the response.
      const connection = ctx.get('connection')
      if (connection !== undefined && typeof connection.authorizeIndex === 'function') {
        if (!connection.authorizeIndex(req, res)) return
      }

      const method = req.method ?? 'GET'
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' })
        res.end()
        return
      }

      try {
        const fonts = await currentFonts(ctx)
        writeJson(res, 200, { fonts, source: 'gdi', at: Date.now() })
      } catch (error) {
        ctx.logger?.warn?.('font-dropdown: font enumeration failed: %s', String(error))
        writeJson(res, 500, { fonts: [], source: 'error', error: String(error?.message ?? error) })
      }
    },
  }), 'font-dropdown: installed font families route')
}