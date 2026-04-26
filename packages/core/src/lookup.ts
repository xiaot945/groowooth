import { percentileToZ, zToValue } from './lms'
import { zToValueSdTable } from './sd-table'
import {
  DEFAULT_LOOKUP_PERCENTILES,
  getDisplayXUnit,
  getIndicatorData,
  getRowsForSex,
  isLmsIndicatorData,
  isSdIndicatorData,
  toDisplayX
} from './standard-data'
import { OutOfRangeError } from './errors'
import type { Indicator, Sex, Standard } from './types'

export interface LookupInput {
  standard: Standard
  indicator: Indicator
  sex: Sex
  xRange?: [number, number]
  percentiles?: number[]
}

export interface LookupPoint {
  x: number
  value: number
}

export interface CurveData {
  standard: Standard
  indicator: Indicator
  sex: Sex
  xType: 'age' | 'length' | 'height'
  xUnit: 'months' | 'cm'
  percentiles: number[]
  curves: Record<string, LookupPoint[]>
}

function toCurveKey(percentile: number): string {
  return `p${percentile}`
}

function clampPercentile(percentile: number): number {
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile >= 100) {
    throw new RangeError('percentiles must be finite numbers between 0 and 100')
  }

  return percentile
}

function snapPercentileToSdZ(percentile: number): number {
  const z = percentileToZ(percentile / 100)
  return Math.max(-3, Math.min(3, Math.round(z)))
}

export function lookup(input: LookupInput): CurveData {
  const indicatorData = getIndicatorData(input.standard, input.indicator)

  if (!indicatorData) {
    throw new OutOfRangeError(`Indicator ${input.indicator} is not available for ${input.standard}.`)
  }

  const rows = getRowsForSex(indicatorData, input.sex)
  const requestedPercentiles = (input.percentiles ?? [...DEFAULT_LOOKUP_PERCENTILES]).map(clampPercentile)
  const curves = Object.fromEntries(requestedPercentiles.map((percentile) => [toCurveKey(percentile), [] as LookupPoint[]]))

  for (const row of rows) {
    const displayX = toDisplayX(indicatorData.xUnit, indicatorData.xType, row.x)

    if (input.xRange && (displayX < input.xRange[0] || displayX > input.xRange[1])) {
      continue
    }

    for (const percentile of requestedPercentiles) {
      const key = toCurveKey(percentile)
      if (isLmsIndicatorData(indicatorData)) {
        curves[key].push({
          x: displayX,
          value: zToValue(percentileToZ(percentile / 100), row)
        })
      } else if (isSdIndicatorData(indicatorData)) {
        curves[key].push({
          x: displayX,
          value: zToValueSdTable(snapPercentileToSdZ(percentile), row)
        })
      }
    }
  }

  return {
    standard: input.standard,
    indicator: input.indicator,
    sex: input.sex,
    xType: indicatorData.xType,
    xUnit: getDisplayXUnit(indicatorData.xUnit, indicatorData.xType),
    percentiles: requestedPercentiles,
    curves
  }
}
