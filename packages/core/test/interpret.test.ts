import { describe, expect, it } from 'vitest'

import { interpret } from '../src/interpret'

describe('interpret', () => {
  it('renders the 50th percentile for z=0', () => {
    const result = interpret({
      zScore: 0,
      indicator: 'height-for-age',
      ageMonths: 24,
      sex: 'female'
    })

    expect(result.range).toBe('within_2_sd')
    expect(result.description).toContain('第 50 百分位')
    expect(result.disclaimer).toBeDefined()
  })

  it('treats z=2 as within_2_sd', () => {
    const result = interpret({
      zScore: 2,
      indicator: 'weight-for-age',
      ageMonths: 24,
      sex: 'male'
    })

    expect(result.range).toBe('within_2_sd')
  })

  it('treats z=-2.5 as beyond_2_sd without clinical wording', () => {
    const result = interpret({
      zScore: -2.5,
      indicator: 'bmi-for-age',
      ageMonths: 36,
      sex: 'female',
      standard: 'who-2006'
    })

    expect(result.range).toBe('beyond_2_sd')
    for (const banned of ['继续', '建议', '应该', '需要', 'stunted', 'obese', '肥胖', '矮小']) {
      expect(result.description).not.toContain(banned)
    }
  })
})
