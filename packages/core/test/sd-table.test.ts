import { describe, expect, it } from 'vitest'

import { valueToZSdTable, zToValueSdTable } from '../src/sd-table'
import type { SdRow } from '../src/types'

const row: SdRow = {
  x: 0,
  sds: {
    neg3: 4,
    neg2: 6,
    neg1: 8,
    median: 10,
    pos1: 12,
    pos2: 14,
    pos3: 16
  }
}

describe('sd-table', () => {
  it('interpolates values to z-scores', () => {
    expect(valueToZSdTable(10, row)).toBe(0)
    expect(valueToZSdTable(11, row)).toBe(0.5)
    expect(valueToZSdTable(8, row)).toBe(-1)
    expect(valueToZSdTable(15, row)).toBe(2.5)
  })

  it('clamps measurements beyond the SD table to +/-3', () => {
    expect(valueToZSdTable(2, row)).toBe(-3)
    expect(valueToZSdTable(20, row)).toBe(3)
  })

  it('maps z-scores back to measurement values', () => {
    expect(zToValueSdTable(0, row)).toBe(10)
    expect(zToValueSdTable(-1, row)).toBe(8)
    expect(zToValueSdTable(0.5, row)).toBe(11)
  })
})
