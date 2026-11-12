import { app, session, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'

const RENDERER_FILE = pathToFileURL(join(__dirname, '../renderer/index.html')).href

/** True only for the app's own page (the built file, or the dev server while developing). */
export function isAppUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      return parsed.origin === new URL(process.env['ELECTRON_RENDERER_URL']).origin
    }
    parsed.hash = ''
    parsed.search = ''
    return parsed.href === RENDERER_FILE
  } catch {
    return false
  }
}

/** Opens web links in the user's browser; anything else (file:, ms-settings:, …) is ignored. */
export function openExternalSafely(url: string): void {
  try {
    const { protocol } = new URL(url)
    if (protocol === 'https:' || protocol === 'http:') void shell.openExternal(url)
  } catch {
    // Not a URL; ignore.
  }
}

/**
 * Applies to every window, including any created later: pages may not navigate away, open
 * new windows, embed webviews or get device permissions. The app needs none of these, and
 * blocking them means a page that somehow loaded foreign content never keeps `window.api`.
 */
export function hardenWebContents(): void {
  app.on('web-contents-created', (_e, contents) => {
    const blockForeign = (event: Electron.Event, url: string): void => {
      if (!isAppUrl(url)) event.preventDefault()
    }
    contents.on('will-navigate', blockForeign)
    contents.on('will-redirect', blockForeign)
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(url)
      return { action: 'deny' }
    })
  })

  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)
}
