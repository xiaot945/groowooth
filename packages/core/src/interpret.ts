import { zToPercentile } from './lms'
import { DISCLAIMER, type Indicator, type Sex, type Standard, type ZRange } from './types'

export interface InterpretInput {
  zScore: number
  indicator: Indicator
  ageMonths: number
  sex: Sex
  standard?: Standard
}

export interface InterpretResult {
  description: string
  range: ZRange
  disclaimer: string
}

function getZRange(zScore: number): ZRange {
  const magnitude = Math.abs(zScore)

  if (magnitude > 3) {
    return 'beyond_3_sd'
  }

  if (magnitude > 2) {
    return 'beyond_2_sd'
  }

  return 'within_2_sd'
}

function formatZScore(zScore: number): string {
  return `${zScore >= 0 ? '+' : ''}${zScore.toFixed(2)}`
}

function indicatorLabel(indicator: Indicator): string {
  switch (indicator) {
    case 'height-for-age':
      return '身高'
    case 'weight-for-age':
      return '体重'
    case 'bmi-for-age':
      return 'BMI'
    case 'head-for-age':
      return '头围'
    case 'weight-for-length':
      return '身长别体重'
    case 'weight-for-height':
      return '身高别体重'
  }
}

function sexLabel(sex: Sex): string {
  return sex === 'male' ? '男宝' : '女宝'
}

function standardLabel(standard: Standard): string {
  switch (standard) {
    case 'who-2006':
      return 'WHO 2006'
    case 'who-2007':
      return 'WHO 2007'
    case 'nhc-2022':
      return 'NHC 2022'
  }
}

export async function interpret(input: InterpretInput): Promise<InterpretResult> {
  const percentile = Math.round(zToPercentile(input.zScore) * 100)
  const standard = input.standard ?? 'nhc-2022'

  return {
    description: `您家${sexLabel(input.sex)}在 ${input.ageMonths} 个月时${indicatorLabel(input.indicator)}位于第 ${percentile} 百分位（z=${formatZScore(
      input.zScore
    )}，按 ${standardLabel(standard)} 标准）。`,
    range: getZRange(input.zScore),
    disclaimer: DISCLAIMER
  }
}
