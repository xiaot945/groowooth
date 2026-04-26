import { describe, expect, it } from 'vitest'

import { ageInMonths } from './age'

describe('ageInMonths', () => {
  it('returns whole months for exact anniversaries', () => {
    expect(ageInMonths('2024-04-26', '2026-04-26')).toBe(24)
  })

  it('rounds to the nearest half month', () => {
    expect(ageInMonths('2024-04-26', '2026-04-11')).toBe(23.5)
  })

  it('returns zero on the birth date', () => {
    expect(ageInMonths('2026-04-26', '2026-04-26')).toBe(0)
  })

  it('handles roughly six months of growth', () => {
    expect(ageInMonths('2025-10-26', '2026-04-26')).toBe(6)
  })
})
