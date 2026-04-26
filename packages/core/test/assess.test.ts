import { describe, expect, it } from 'vitest'

import { assess } from '../src/assess'
import { OutOfPlausibleRangeError } from '../src/errors'
import type { IndicatorResult } from '../src/assess'

function byIndicator(assessments: IndicatorResult[], indicator: string): IndicatorResult {
  const result = assessments.find((entry) => entry.indicator === indicator)
  if (!result) {
    throw new Error(`Missing assessment for ${indicator}`)
  }
  return result
}

describe('assess', () => {
  it('assesses a 12 month boy against the default NHC standard', () => {
    const result = assess({
      ageMonths: 12,
      sex: 'male',
      heightCm: 75,
      weightKg: 10
    })

    expect(result.standard).toBe('nhc-2022')
    expect(result.disclaimer).toBeDefined()
    expect(Math.abs(byIndicator(result.assessments, 'height-for-age').zScore)).toBeLessThan(2)
    expect(Math.abs(byIndicator(result.assessments, 'weight-for-age').zScore)).toBeLessThan(2)
  })

  it('keeps WHO 2006 z-scores close to the NHC result for the same child', () => {
    const nhc = assess({
      ageMonths: 12,
      sex: 'male',
      heightCm: 75,
      weightKg: 10
    })
    const who = assess({
      ageMonths: 12,
      sex: 'male',
      heightCm: 75,
      weightKg: 10,
      standard: 'who-2006'
    })

    expect(who.disclaimer).toBeDefined()
    expect(
      Math.abs(
        byIndicator(who.assessments, 'height-for-age').zScore -
          byIndicator(nhc.assessments, 'height-for-age').zScore
      )
    ).toBeLessThanOrEqual(0.5)
    expect(
      Math.abs(
        byIndicator(who.assessments, 'weight-for-age').zScore -
          byIndicator(nhc.assessments, 'weight-for-age').zScore
      )
    ).toBeLessThanOrEqual(0.5)
  })

  it('assesses an older child against WHO 2007', () => {
    const result = assess({
      ageMonths: 120,
      sex: 'male',
      heightCm: 138,
      weightKg: 32,
      standard: 'who-2007'
    })

    expect(result.standard).toBe('who-2007')
    expect(result.disclaimer).toBeDefined()
    expect(Math.abs(byIndicator(result.assessments, 'height-for-age').zScore)).toBeLessThan(2)
    expect(Math.abs(byIndicator(result.assessments, 'weight-for-age').zScore)).toBeLessThan(2)
    expect(Math.abs(byIndicator(result.assessments, 'bmi-for-age').zScore)).toBeLessThan(2)
  })

  it('rejects implausible measurements', () => {
    expect(() =>
      assess({
        ageMonths: 12,
        sex: 'male',
        heightCm: 200,
        weightKg: 10
      })
    ).toThrow(OutOfPlausibleRangeError)
  })
})
