import { z } from 'zod'

import { OutOfPlausibleRangeError, OutOfRangeError } from './errors'
import { valueToZ, zToPercentile } from './lms'
import { valueToZSdTable } from './sd-table'
import {
  findNearestRow,
  getIndicatorData,
  getRowsForSex,
  getStandardDataset,
  isLmsIndicatorData,
  isSdIndicatorData,
  isWithinIndicatorRange,
  toSourceX
} from './standard-data'
import { DISCLAIMER, type Indicator, type Sex, type Standard, type StandardDataset, type ZRange } from './types'

const assessInputSchema = z.object({
  ageMonths: z.number().finite().nonnegative(),
  sex: z.enum(['male', 'female']),
  heightCm: z.number().finite().positive().optional(),
  weightKg: z.number().finite().positive().optional(),
  headCircumferenceCm: z.number().finite().positive().optional(),
  standard: z.enum(['who-2006', 'who-2007', 'nhc-2022']).default('nhc-2022'),
  gestationalWeeks: z.number().finite().positive().optional()
})

export interface AssessInput {
  ageMonths: number
  sex: Sex
  heightCm?: number
  weightKg?: number
  headCircumferenceCm?: number
  standard?: Standard
  gestationalWeeks?: number
}

export interface IndicatorResult {
  indicator: Indicator
  zScore: number
  percentile: number
  range: ZRange
}

export interface AssessResult {
  standard: Standard
  standardVersion: string
  assessments: IndicatorResult[]
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

function assertPlausibleMeasurement(name: 'heightCm' | 'weightKg' | 'headCircumferenceCm', ageMonths: number, value: number): void {
  const limits =
    name === 'heightCm'
      ? ageMonths <= 81
        ? { min: 35, max: 130 }
        : { min: 60, max: 220 }
      : name === 'weightKg'
        ? ageMonths <= 81
          ? { min: 0.5, max: 40 }
          : { min: 5, max: 200 }
        : { min: 20, max: 60 }

  if (value < limits.min || value > limits.max) {
    throw new OutOfPlausibleRangeError(`${name} is outside the plausible range for age ${ageMonths} months.`)
  }
}

function assessIndicator(args: {
  standard: Standard
  indicator: Indicator
  sex: Sex
  ageMonths: number
  measurement: number
  dataset: StandardDataset
  sizeCm?: number
}): IndicatorResult {
  const indicatorData = getIndicatorData(args.dataset, args.indicator)

  if (!indicatorData) {
    throw new OutOfRangeError(`Indicator ${args.indicator} is not available for ${args.standard}.`)
  }

  const sourceX = toSourceX(indicatorData.xUnit, indicatorData.xType, args.ageMonths, args.sizeCm)
  let zScore: number

  if (isLmsIndicatorData(indicatorData)) {
    const rows = getRowsForSex(indicatorData, args.sex)
    if (!isWithinIndicatorRange(rows, sourceX)) {
      throw new OutOfRangeError(
        `${args.indicator} is outside the supported ${indicatorData.xType} range for ${args.standard}.`
      )
    }

    zScore = valueToZ(args.measurement, findNearestRow(rows, sourceX))
  } else if (isSdIndicatorData(indicatorData)) {
    const rows = getRowsForSex(indicatorData, args.sex)
    if (!isWithinIndicatorRange(rows, sourceX)) {
      throw new OutOfRangeError(
        `${args.indicator} is outside the supported ${indicatorData.xType} range for ${args.standard}.`
      )
    }

    zScore = valueToZSdTable(args.measurement, findNearestRow(rows, sourceX))
  } else {
    throw new RangeError('Unsupported indicator model')
  }

  return {
    indicator: args.indicator,
    zScore,
    percentile: zToPercentile(zScore),
    range: getZRange(zScore)
  }
}

function pickWeightBySizeIndicator(dataset: StandardDataset, ageMonths: number, heightCm: number): Indicator | null {
  const preferred: Indicator[] =
    ageMonths < 24 ? ['weight-for-length', 'weight-for-height'] : ['weight-for-height', 'weight-for-length']

  for (const indicator of preferred) {
    const indicatorData = getIndicatorData(dataset, indicator)
    if (!indicatorData) {
      continue
    }

    if (isLmsIndicatorData(indicatorData) && isWithinIndicatorRange(indicatorData.male, heightCm)) {
      return indicator
    }

    if (isSdIndicatorData(indicatorData) && isWithinIndicatorRange(indicatorData.male, heightCm)) {
      return indicator
    }
  }

  return null
}

/**
 * v1 selects the nearest source row for each assessment and does not interpolate between rows.
 */
export async function assess(input: AssessInput): Promise<AssessResult> {
  const parsed = assessInputSchema.parse(input)
  const standard = parsed.standard
  const dataset = await getStandardDataset(standard)
  const assessments: IndicatorResult[] = []

  if (parsed.heightCm !== undefined) {
    assertPlausibleMeasurement('heightCm', parsed.ageMonths, parsed.heightCm)
    assessments.push(
      assessIndicator({
        standard,
        indicator: 'height-for-age',
        sex: parsed.sex,
        ageMonths: parsed.ageMonths,
        measurement: parsed.heightCm,
        dataset
      })
    )
  }

  if (parsed.weightKg !== undefined) {
    assertPlausibleMeasurement('weightKg', parsed.ageMonths, parsed.weightKg)
    assessments.push(
      assessIndicator({
        standard,
        indicator: 'weight-for-age',
        sex: parsed.sex,
        ageMonths: parsed.ageMonths,
        measurement: parsed.weightKg,
        dataset
      })
    )

    if (parsed.heightCm !== undefined) {
      const bmi = parsed.weightKg / Math.pow(parsed.heightCm / 100, 2)
      assessments.push(
        assessIndicator({
          standard,
          indicator: 'bmi-for-age',
          sex: parsed.sex,
          ageMonths: parsed.ageMonths,
          measurement: bmi,
          dataset
        })
      )

      const weightBySizeIndicator = pickWeightBySizeIndicator(dataset, parsed.ageMonths, parsed.heightCm)
      if (weightBySizeIndicator) {
        assessments.push(
          assessIndicator({
            standard,
            indicator: weightBySizeIndicator,
            sex: parsed.sex,
            ageMonths: parsed.ageMonths,
            measurement: parsed.weightKg,
            dataset,
            sizeCm: parsed.heightCm
          })
        )
      }
    }
  }

  if (parsed.headCircumferenceCm !== undefined) {
    assertPlausibleMeasurement('headCircumferenceCm', parsed.ageMonths, parsed.headCircumferenceCm)
    assessments.push(
      assessIndicator({
        standard,
        indicator: 'head-for-age',
        sex: parsed.sex,
        ageMonths: parsed.ageMonths,
        measurement: parsed.headCircumferenceCm,
        dataset
      })
    )
  }

  return {
    standard,
    standardVersion: dataset.version,
    assessments,
    disclaimer: DISCLAIMER
  }
}
