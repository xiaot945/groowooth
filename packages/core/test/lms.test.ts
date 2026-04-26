import { describe, expect, it } from 'vitest'

import { valueToZ, zToPercentile, zToValue } from '../src/lms'
import type { LmsRow } from '../src/types'

// Source verified before encoding:
// /tmp/groowooth-research/anthro/data-raw/growthstandards/lenanthro.txt
// row: sex=1, age=365, l=1, m=75.7391, s=0.03137
const whoHeightForAgeBoy12Months: LmsRow = {
  x: 365,
  L: 1,
  M: 75.7391,
  S: 0.03137
}

describe('lms', () => {
  it('maps the WHO median to z=0 and preserves round-trips', () => {
    expect(valueToZ(whoHeightForAgeBoy12Months.M, whoHeightForAgeBoy12Months)).toBe(0)

    const oneSdValue =
      whoHeightForAgeBoy12Months.M *
      Math.pow(
        1 + whoHeightForAgeBoy12Months.L * whoHeightForAgeBoy12Months.S,
        1 / whoHeightForAgeBoy12Months.L
      )

    expect(valueToZ(oneSdValue, whoHeightForAgeBoy12Months)).toBeCloseTo(1, 9)

    for (const value of [
      whoHeightForAgeBoy12Months.M * 0.9,
      whoHeightForAgeBoy12Months.M,
      whoHeightForAgeBoy12Months.M * 1.1
    ]) {
      expect(zToValue(valueToZ(value, whoHeightForAgeBoy12Months), whoHeightForAgeBoy12Months)).toBeCloseTo(
        value,
        9
      )
    }
  })

  it('supports the L=0 logarithmic branch', () => {
    const row: LmsRow = { x: 0, L: 0, M: 100, S: 0.1 }

    expect(valueToZ(100, row)).toBe(0)
    expect(zToValue(1, row)).toBeCloseTo(100 * Math.exp(0.1), 12)

    const sample = 91.25
    expect(zToValue(valueToZ(sample, row), row)).toBeCloseTo(sample, 9)
  })

  it('converts z-scores to percentiles', () => {
    expect(zToPercentile(0)).toBeCloseTo(0.5, 6)
    expect(zToPercentile(1.96)).toBeCloseTo(0.975, 3)
  })
})
