/**
 * Draws the app icon (a glowing progress ring on a dark disc) and writes:
 *   build/icon.ico      multi-size icon for the .exe, installer and shortcuts
 *   build/icon.png      512 px, used by electron-builder
 *   resources/icon.png  256 px, the window icon while developing
 * Run with: npm run icons
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { encodePng } from '../src/main/png.ts'
import { drawRing } from '../src/main/ringIcon.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
/** Sky blue, the default focus color, so the icon matches the timer and tray. */
const ARC = '#38bdf8'
const ARC_RGB = [1, 3, 5].map((i) => parseInt(ARC.slice(i, i + 2), 16)) as [number, number, number]
const FRACTION = 0.72

/** Blends a soft disc (glow or knob) onto RGBA pixels, source-over. */
function disc(
  px: Uint8Array,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  [r, g, b]: [number, number, number],
  alpha: number,
  softness = 1
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const cover = Math.max(0, Math.min(1, (radius - d) / softness + 0.5)) * alpha
      if (cover <= 0) continue
      const i = (y * size + x) * 4
      const da = px[i + 3] / 255
      const outA = cover + da * (1 - cover)
      px[i] = Math.round((r * cover + px[i] * da * (1 - cover)) / outA)
      px[i + 1] = Math.round((g * cover + px[i + 1] * da * (1 - cover)) / outA)
      px[i + 2] = Math.round((b * cover + px[i + 2] * da * (1 - cover)) / outA)
      px[i + 3] = Math.round(outA * 255)
    }
  }
}

function drawIcon(size: number): Uint8Array {
  const radius = 0.32
  const px = drawRing({
    size,
    color: ARC,
    fraction: FRACTION,
    trackColor: '#ffffff',
    trackAlpha: 0.13,
    radius,
    thickness: 0.1,
    background: '#121521'
  })
  // Round cap where the arc starts (12 o'clock).
  disc(px, size, size / 2, size / 2 - size * radius, (size * 0.1) / 2, ARC_RGB, 1)
  // White knob at the end of the arc, with a faint halo in the arc color, like the timer ring.
  const angle = 2 * Math.PI * FRACTION
  const kx = size / 2 + Math.sin(angle) * size * radius
  const ky = size / 2 - Math.cos(angle) * size * radius
  if (size >= 32) disc(px, size, kx, ky, size * 0.11, ARC_RGB, 0.25, size * 0.05)
  disc(px, size, kx, ky, size * 0.065, [255, 255, 255], 1)
  return px
}

/** ICO container holding PNG-compressed images (supported since Windows Vista). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

const png = (size: number): Buffer => encodePng(size, size, drawIcon(size))

mkdirSync(join(root, 'build'), { recursive: true })
mkdirSync(join(root, 'resources'), { recursive: true })
const sizes = [16, 24, 32, 48, 64, 128, 256]
writeFileSync(join(root, 'build/icon.ico'), ico(sizes.map((size) => ({ size, png: png(size) }))))
writeFileSync(join(root, 'build/icon.png'), png(512))
writeFileSync(join(root, 'resources/icon.png'), png(256))
console.log(`Wrote build/icon.ico (${sizes.join(', ')}), build/icon.png, resources/icon.png`)
