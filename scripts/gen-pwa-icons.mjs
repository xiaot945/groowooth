import { mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const publicDir = new URL('../packages/web/public/', import.meta.url)
const iconsDir = new URL('./icons/', publicDir)

const BACKGROUND = [0x2e, 0x7d, 0x69, 0xff]
const FOREGROUND = [0xff, 0xff, 0xff, 0xff]

function makeCrc32Table() {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let value = index

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }

    table[index] = value >>> 0
  }

  return table
}

const CRC32_TABLE = makeCrc32Table()

function crc32(buffer) {
  let value = 0xffffffff

  for (const byte of buffer) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  }

  return (value ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32BE(data.length, 0)

  const body = Buffer.concat([typeBuffer, data])
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(body), 0)

  return Buffer.concat([lengthBuffer, body, crcBuffer])
}

function setPixel(image, size, x, y, rgba) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return
  }

  const offset = y * (size * 4) + x * 4
  image[offset] = rgba[0]
  image[offset + 1] = rgba[1]
  image[offset + 2] = rgba[2]
  image[offset + 3] = rgba[3]
}

function drawDisc(image, size, centerX, centerY, radius, rgba) {
  const minX = Math.max(0, Math.floor(centerX - radius))
  const maxX = Math.min(size - 1, Math.ceil(centerX + radius))
  const minY = Math.max(0, Math.floor(centerY - radius))
  const maxY = Math.min(size - 1, Math.ceil(centerY + radius))
  const radiusSquared = radius * radius

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX
      const dy = y - centerY

      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(image, size, x, y, rgba)
      }
    }
  }
}

function drawLine(image, size, start, end, thickness, rgba) {
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY), 1)
  const radius = thickness / 2

  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps
    const x = start[0] + deltaX * ratio
    const y = start[1] + deltaY * ratio
    drawDisc(image, size, x, y, radius, rgba)
  }
}

function createCenteredBounds(size, widthRatio, heightRatio = widthRatio) {
  const width = size * widthRatio
  const height = size * heightRatio

  return {
    left: (size - width) / 2,
    top: (size - height) / 2,
    right: (size + width) / 2,
    bottom: (size + height) / 2
  }
}

function drawOverlay(image, size, bounds) {
  const width = bounds.right - bounds.left
  const height = bounds.bottom - bounds.top
  const thickness = Math.max(10, Math.round(Math.min(width, height) * 0.12))
  const points = [
    [bounds.left + width * 0.08, bounds.top + height * 0.72],
    [bounds.left + width * 0.36, bounds.top + height * 0.54],
    [bounds.left + width * 0.62, bounds.top + height * 0.42],
    [bounds.left + width * 0.92, bounds.top + height * 0.1]
  ]

  for (let index = 0; index < points.length - 1; index += 1) {
    drawLine(image, size, points[index], points[index + 1], thickness, FOREGROUND)
  }

  drawDisc(
    image,
    size,
    points[points.length - 1][0],
    points[points.length - 1][1],
    thickness * 0.7,
    FOREGROUND
  )
}

function createImage(size, { overlayBounds }) {
  const image = Buffer.alloc(size * size * 4)

  for (let offset = 0; offset < image.length; offset += 4) {
    image[offset] = BACKGROUND[0]
    image[offset + 1] = BACKGROUND[1]
    image[offset + 2] = BACKGROUND[2]
    image[offset + 3] = BACKGROUND[3]
  }

  if (overlayBounds) {
    drawOverlay(image, size, overlayBounds)
  }

  return image
}

function encodePng(size, image) {
  const stride = size * 4
  const scanlines = Buffer.alloc(size * (stride + 1))

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (stride + 1)
    scanlines[rowOffset] = 0
    image.copy(scanlines, rowOffset + 1, y * stride, (y + 1) * stride)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function countForegroundPixels(image, size, bounds) {
  let count = 0
  const startX = Math.max(0, Math.floor(bounds.left))
  const endX = Math.min(size, Math.ceil(bounds.right))
  const startY = Math.max(0, Math.floor(bounds.top))
  const endY = Math.min(size, Math.ceil(bounds.bottom))

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = y * (size * 4) + x * 4

      if (
        image[offset] !== BACKGROUND[0] ||
        image[offset + 1] !== BACKGROUND[1] ||
        image[offset + 2] !== BACKGROUND[2] ||
        image[offset + 3] !== BACKGROUND[3]
      ) {
        count += 1
      }
    }
  }

  return count
}

async function main() {
  await mkdir(iconsDir, { recursive: true })

  const regular192 = createImage(192, { overlayBounds: createCenteredBounds(192, 0.7) })
  const regular512 = createImage(512, { overlayBounds: createCenteredBounds(512, 0.7) })
  const maskable512 = createImage(512, { overlayBounds: createCenteredBounds(512, 0.5) })
  const appleTouch192 = createImage(192, { overlayBounds: createCenteredBounds(192, 0.7) })
  const maskableSafeZone = createCenteredBounds(512, 0.8)
  const maskableForegroundCount = countForegroundPixels(maskable512, 512, maskableSafeZone)

  if (maskableForegroundCount <= 0) {
    throw new Error('Maskable icon safe zone does not contain any visible foreground pixels.')
  }

  const files = [
    ['icon-192.png', encodePng(192, regular192), iconsDir],
    ['icon-512.png', encodePng(512, regular512), iconsDir],
    ['icon-maskable-512.png', encodePng(512, maskable512), iconsDir],
    ['apple-touch-icon.png', encodePng(192, appleTouch192), publicDir]
  ]

  await Promise.all(
    files.map(([name, data, directory]) => writeFile(new URL(name, directory), data))
  )

  console.log(`maskable safe-zone foreground pixels: ${maskableForegroundCount}`)

  for (const [name, , directory] of files) {
    console.log(`wrote ${new URL(name, directory).pathname}`)
  }
}

await main()
