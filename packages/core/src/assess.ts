import { NotImplementedError } from './errors'
import { valueToZ, zToPercentile } from './lms'
import { DISCLAIMER, type Indicator, type LmsRow, type Sex, type Standard, type ZRange } from './types'

export interface AssessInput {
  standard: Standard
  indicator: Indicator
  sex: Sex
  ageMonths: number
  value: number
}

export interface AssessResult {
  zScore: number
  percentile: number
  range: ZRange
  disclaimer: string
}

const WHO_2006_HEIGHT_FOR_AGE_MALE_12_MONTHS: LmsRow = {
  x: 365,
  L: 1,
  M: 75.7391,
  S: 0.03137
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

export function assess(input: AssessInput): AssessResult {
  const { standard, indicator, sex, ageMonths, value } = input

  const isSupportedFixture =
    standard === 'who-2006' &&
    indicator === 'height-for-age' &&
    sex === 'male' &&
    ageMonths === 12

  if (!isSupportedFixture) {
    throw new NotImplementedError(
      'Only who-2006 height-for-age for male at 12 months is supported in this session.'
    )
  }

  const zScore = valueToZ(value, WHO_2006_HEIGHT_FOR_AGE_MALE_12_MONTHS)

  return {
    zScore,
    percentile: zToPercentile(zScore),
    range: getZRange(zScore),
    disclaimer: DISCLAIMER
  }
}
