import { describe, expect, it } from 'vitest'

import { tools } from '../src/tools'

function getTool(name: string) {
  const tool = tools.find((entry) => entry.name === name)

  if (!tool) {
    throw new Error(`Missing tool definition for ${name}`)
  }

  return tool
}

describe('mcp tools', () => {
  it('assess_growth returns parseable JSON with assessments and disclaimer', async () => {
    const response = await getTool('assess_growth').handler({
      ageMonths: 24,
      sex: 'female',
      heightCm: 86,
      weightKg: 12,
      standard: 'nhc'
    })

    expect(response.isError).toBeUndefined()
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text) as { assessments?: unknown[]; disclaimer?: string }

    expect(Array.isArray(parsed.assessments)).toBe(true)
    expect(parsed.assessments?.length).toBeGreaterThan(0)
    expect(parsed.disclaimer).toBeTruthy()
  })

  it('get_growth_chart returns SVG text content', async () => {
    const response = await getTool('get_growth_chart').handler({
      measurements: [{ date: '2026-04-26', ageMonths: 24, value: 86 }],
      indicator: 'height',
      sex: 'female',
      standard: 'nhc'
    })

    expect(response.isError).toBeUndefined()
    expect(response.content[0]?.type).toBe('text')
    expect(response.content[0]?.text.startsWith('<svg')).toBe(true)
  })

  it('interpret_growth renders the 50th percentile text for z=0', async () => {
    const response = await getTool('interpret_growth').handler({
      zScore: 0,
      indicator: 'height-for-age',
      ageMonths: 24,
      sex: 'female',
      standard: 'nhc'
    })

    expect(response.isError).toBeUndefined()
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    expect(text).toContain('第 50 百分位')
  })

  it('assess_growth returns isError for implausible measurements', async () => {
    const response = await getTool('assess_growth').handler({
      ageMonths: 24,
      sex: 'female',
      heightCm: 999,
      standard: 'nhc'
    })

    expect(response.isError).toBe(true)
    expect(response.content[0]?.type).toBe('text')
    expect(response.content[0]?.text.startsWith('Error:')).toBe(true)
  })
})
