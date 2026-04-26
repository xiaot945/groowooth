import { describe, expect, it } from 'vitest'

import { renderChart } from '../src/chart-svg'
import { DISCLAIMER } from '../src/types'

describe('renderChart', () => {
  it('renders percentile curves and shared framing with no measurements', () => {
    const svg = renderChart({
      standard: 'nhc-2022',
      indicator: 'height-for-age',
      sex: 'male',
      measurements: []
    })

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect((svg.match(/data-percentile="/g) ?? []).length).toBe(5)
    expect(svg).toContain('男童 身高 (NHC 2022)')
    expect(svg).toContain(DISCLAIMER)
  })

  it('renders one circle per measurement with value tooltips', () => {
    const svg = renderChart({
      standard: 'nhc-2022',
      indicator: 'height-for-age',
      sex: 'male',
      locale: 'en',
      measurements: [
        { date: '2026-01-10', x: 6, value: 66.2 },
        { date: '2026-02-10', x: 7, value: 68.1 },
        { date: '2026-03-10', x: 8, value: 69.7 }
      ]
    })

    expect((svg.match(/<circle\b/g) ?? []).length).toBe(3)
    expect(svg).toContain('<title>Jan 10, 2026')
    expect(svg).toContain('66.2 cm')
    expect(svg).toContain('68.1 cm')
    expect(svg).toContain('69.7 cm')
  })

  it('uses zh-CN titles by default', () => {
    const maleSvg = renderChart({
      standard: 'nhc-2022',
      indicator: 'height-for-age',
      sex: 'male',
      measurements: []
    })
    const femaleSvg = renderChart({
      standard: 'nhc-2022',
      indicator: 'weight-for-age',
      sex: 'female',
      measurements: []
    })

    expect(maleSvg).toContain('男童 身高 (NHC 2022)')
    expect(femaleSvg).toContain('女童 体重 (NHC 2022)')
  })

  it('uses English titles when locale is en', () => {
    const svg = renderChart({
      standard: 'who-2006',
      indicator: 'height-for-age',
      sex: 'male',
      measurements: [],
      locale: 'en'
    })

    expect(svg).toContain('Boy Height (WHO 2006)')
  })

  it('produces a basically well-formed svg string', () => {
    const svg = renderChart({
      standard: 'nhc-2022',
      indicator: 'height-for-age',
      sex: 'male',
      measurements: [{ x: 12, value: 78.4 }]
    })

    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>$/)
    expect((svg.match(/"/g) ?? []).length % 2).toBe(0)
    expect(svg).not.toMatch(/<[^>]*$/)
    expect(svg).not.toContain('undefined')
  })
})
