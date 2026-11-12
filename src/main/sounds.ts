import { app, dialog, net, protocol, type BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { copyFileSync, mkdirSync, statSync, unlinkSync } from 'fs'
import { basename, extname, join } from 'path'
import { pathToFileURL } from 'url'
import { translator } from '../shared/i18n'
import { SOUND_SCHEME } from '../shared/ipc'
import type { CustomSound, Settings } from '../shared/types'

const EXTENSIONS = ['mp3', 'ogg', 'wav']
/** Decoding needs the whole file in memory, so very large files are refused. */
const MAX_MB = 50

function soundsDir(): string {
  return join(app.getPath('userData'), 'sounds')
}

/** Must run before the app is ready so the renderer may fetch() from the scheme. */
export function registerSoundScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SOUND_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

const MIME: Record<string, string> = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' }

/**
 * Serves ffsound://sound/<file> from userData/sounds, and nothing outside it. The page is
 * another origin (file:// or the dev server), so responses carry a CORS header.
 */
export function serveSounds(): void {
  const dir = soundsDir()
  mkdirSync(dir, { recursive: true })
  const cors = { 'Access-Control-Allow-Origin': '*' }
  protocol.handle(SOUND_SCHEME, async (request) => {
    const name = basename(decodeURIComponent(new URL(request.url).pathname))
    const ext = extname(name).slice(1).toLowerCase()
    if (!EXTENSIONS.includes(ext)) return new Response('Not found', { status: 404, headers: cors })
    try {
      const file = await net.fetch(pathToFileURL(join(dir, name)).toString())
      return new Response(file.body, {
        status: file.status,
        headers: { ...cors, 'Content-Type': MIME[ext] }
      })
    } catch {
      return new Response('Not found', { status: 404, headers: cors })
    }
  })
}

/** Asks for a file, copies it into the app's folder, and returns the settings change to save. */
export async function importSound(
  parent: BrowserWindow | null,
  kind: CustomSound['kind'],
  settings: Settings
): Promise<Partial<Settings> | null> {
  const options = {
    properties: ['openFile' as const],
    filters: [{ name: 'Audio', extensions: EXTENSIONS }]
  }
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  const source = result.filePaths[0]
  if (result.canceled || !source) return null

  const ext = extname(source).toLowerCase()
  if (!EXTENSIONS.includes(ext.slice(1))) return null
  if (statSync(source).size > MAX_MB * 1024 * 1024) {
    const message = translator(settings.language)('sound.tooLarge', { mb: MAX_MB })
    const box = { type: 'warning' as const, title: 'Focus Flow', message }
    if (parent) await dialog.showMessageBox(parent, box)
    else await dialog.showMessageBox(box)
    return null
  }
  const id = `custom-${randomUUID()}`
  const file = `${id}${ext}`
  mkdirSync(soundsDir(), { recursive: true })
  copyFileSync(source, join(soundsDir(), file))

  const sound: CustomSound = { id, name: basename(source, extname(source)), file, kind }
  const patch: Partial<Settings> = { customSounds: [...settings.customSounds, sound] }
  // Make the new sound audible right away so the user hears that it worked.
  if (kind === 'alarm') patch.alarmSound = id
  else patch.ambientVolumes = { ...settings.ambientVolumes, [id]: 50 }
  return patch
}

export function removeSound(id: string, settings: Settings): Partial<Settings> {
  const sound = settings.customSounds.find((c) => c.id === id)
  if (sound) {
    try {
      unlinkSync(join(soundsDir(), sound.file))
    } catch {
      // Already gone; nothing to clean up.
    }
  }
  const ambientVolumes = { ...settings.ambientVolumes }
  delete ambientVolumes[id]
  return {
    customSounds: settings.customSounds.filter((c) => c.id !== id),
    ambientVolumes,
    alarmSound: settings.alarmSound === id ? 'softBell' : settings.alarmSound
  }
}
