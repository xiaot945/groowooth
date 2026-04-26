import { NHC_2022, WHO_2006, WHO_2007 } from './standards'
import type {
  AxisType,
  AxisUnit,
  Indicator,
  LmsIndicatorData,
  LmsRow,
  SdIndicatorData,
  SdRow,
  Sex,
  Standard,
  StandardDataset,
  StandardIndicatorData
} from './types'

export const STANDARD_DATASETS: Record<Standard, StandardDataset> = {
  'who-2006': WHO_2006,
  'who-2007': WHO_2007,
  'nhc-2022': NHC_2022
}

export const DEFAULT_LOOKUP_PERCENTILES = [3, 15, 50, 85, 97] as const
export const DAYS_PER_MONTH = 365.25 / 12

export function getStandardDataset(standard: Standard): StandardDataset {
  return STANDARD_DATASETS[standard]
}

export function getIndicatorData(standard: Standard, indicator: Indicator): StandardIndicatorData | null {
  return getStandardDataset(standard).indicators[indicator] ?? null
}

export function isLmsIndicatorData(indicator: StandardIndicatorData): indicator is LmsIndicatorData {
  return indicator.model === 'lms'
}

export function isSdIndicatorData(indicator: StandardIndicatorData): indicator is SdIndicatorData {
  return indicator.model === 'sd-table'
}

export function getRowsForSex(indicator: LmsIndicatorData, sex: Sex): LmsRow[]
export function getRowsForSex(indicator: SdIndicatorData, sex: Sex): SdRow[]
export function getRowsForSex(indicator: StandardIndicatorData, sex: Sex): LmsRow[] | SdRow[] {
  return sex === 'male' ? indicator.male : indicator.female
}

export function toSourceX(xUnit: AxisUnit, xType: AxisType, ageMonths: number, sizeCm?: number): number {
  if (xType === 'age') {
    return xUnit === 'days' ? ageMonths * DAYS_PER_MONTH : ageMonths
  }

  if (sizeCm === undefined) {
    throw new RangeError(`sizeCm is required for ${xType}-based indicators`)
  }

  return sizeCm
}

export function toDisplayX(xUnit: AxisUnit, xType: AxisType, sourceX: number): number {
  if (xType === 'age') {
    return xUnit === 'days' ? sourceX / DAYS_PER_MONTH : sourceX
  }

  return sourceX
}

export function getDisplayXUnit(xUnit: AxisUnit, xType: AxisType): 'months' | 'cm' {
  return xType === 'age' ? 'months' : 'cm'
}

export function findNearestRow<Row extends { x: number }>(rows: Row[], targetX: number): Row {
  if (rows.length === 0) {
    throw new RangeError('Cannot select a row from an empty dataset')
  }

  let nearest = rows[0]
  let nearestDistance = Math.abs(nearest.x - targetX)

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]
    const distance = Math.abs(row.x - targetX)
    if (distance < nearestDistance) {
      nearest = row
      nearestDistance = distance
    }
  }

  return nearest
}

export function isWithinIndicatorRange<Row extends { x: number }>(rows: Row[], value: number): boolean {
  const first = rows[0]
  const last = rows.at(-1)
  return Boolean(first && last && value >= first.x && value <= last.x)
}
