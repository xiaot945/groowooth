import type { SdRow } from './types'

type SdPoint = { z: number; value: number }

function toPoints(row: SdRow): SdPoint[] {
  return [
    { z: -3, value: row.sds.neg3 },
    { z: -2, value: row.sds.neg2 },
    { z: -1, value: row.sds.neg1 },
    { z: 0, value: row.sds.median },
    { z: 1, value: row.sds.pos1 },
    { z: 2, value: row.sds.pos2 },
    { z: 3, value: row.sds.pos3 }
  ]
}

/**
 * Convert a measurement to z-score by piecewise linear interpolation between
 * adjacent SD points. Values beyond the table are clamped to +/-3.
 */
export function valueToZSdTable(value: number, row: SdRow): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('value must be a finite number')
  }

  const points = toPoints(row)
  const first = points[0]
  const last = points.at(-1)

  if (!first || !last) {
    throw new RangeError('row must contain SD points')
  }

  if (value <= first.value) {
    return -3
  }

  if (value >= last.value) {
    return 3
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const lower = points[index]
    const upper = points[index + 1]

    if (value >= lower.value && value <= upper.value) {
      if (upper.value === lower.value) {
        return lower.z
      }

      return lower.z + (value - lower.value) / (upper.value - lower.value)
    }
  }

  throw new RangeError('value does not fit within the SD table ordering')
}

/**
 * Convert a z-score to value by piecewise linear interpolation between
 * adjacent SD points. z beyond the table is clamped to the nearest endpoint.
 */
export function zToValueSdTable(z: number, row: SdRow): number {
  if (!Number.isFinite(z)) {
    throw new RangeError('z must be a finite number')
  }

  const points = toPoints(row)
  const first = points[0]
  const last = points.at(-1)

  if (!first || !last) {
    throw new RangeError('row must contain SD points')
  }

  if (z <= first.z) {
    return first.value
  }

  if (z >= last.z) {
    return last.value
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const lower = points[index]
    const upper = points[index + 1]

    if (z >= lower.z && z <= upper.z) {
      return lower.value + (z - lower.z) * (upper.value - lower.value)
    }
  }

  throw new RangeError('z does not fit within the SD table ordering')
}
