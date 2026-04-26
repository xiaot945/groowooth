import { describe, expect, it } from 'vitest'

import { formatAgeLabel } from './format'

describe('formatAgeLabel', () => {
  it('formats infancy in months', () => {
    expect(formatAgeLabel(0)).toBe('0 月')
    expect(formatAgeLabel(11)).toBe('11 月')
  })

  it('formats exact years cleanly', () => {
    expect(formatAgeLabel(12)).toBe('1 岁')
  })

  it('formats years with trailing months', () => {
    expect(formatAgeLabel(27)).toBe('2 岁 3 月')
  })
})
