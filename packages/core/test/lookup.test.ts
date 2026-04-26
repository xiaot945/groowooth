import { describe, expect, it } from 'vitest'

import { lookup } from '../src/lookup'

describe('lookup', () => {
  it('returns aligned percentile curves for WHO 2006 height-for-age', () => {
    const result = lookup({
      standard: 'who-2006',
      indicator: 'height-for-age',
      sex: 'male',
      xRange: [0, 24]
    })

    expect(result.percentiles.length).toBe(5)
    expect(result.xUnit).toBe('months')

    const lengths = Object.values(result.curves).map((curve) => curve.length)
    expect(lengths[0]).toBeGreaterThanOrEqual(24)

    for (const length of lengths.slice(1)) {
      expect(length).toBe(lengths[0])
    }
  })
})
