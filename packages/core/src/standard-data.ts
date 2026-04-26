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

const defaultLoaders: Record<Standard, () => Promise<StandardDataset>> = {
  'who-2006': () => import('./standards/who-2006').then((module) => module.WHO_2006),
  'who-2007': () => import('./standards/who-2007').then((module) => module.WHO_2007),
  'nhc-2022': () => import('./standards/nhc-2022').then((module) => module.NHC_2022)
}
const loaders = new Map<Standard, () => Promise<StandardDataset>>(Object.entries(defaultLoaders) as [
  Standard,
  () => Promise<StandardDataset>
][])
const cache = new Map<Standard, StandardDataset>()
const pendingLoads = new Map<Standard, Promise<StandardDataset>>()

export const DEFAULT_LOOKUP_PERCENTILES = [3, 15, 50, 85, 97] as const
export const DAYS_PER_MONTH = 365.25 / 12

export async function getStandardDataset(standard: Standard): Promise<StandardDataset> {
  const cached = cache.get(standard)
  if (cached) {
    return cached
  }

  const pending = pendingLoads.get(standard)
  if (pending) {
    return pending
  }

  const loader = loaders.get(standard)
  if (!loader) {
    throw new RangeError(`No standard dataset loader registered for ${standard}`)
  }

  const nextLoad = loader()
    .then((dataset) => {
      cache.set(standard, dataset)
      pendingLoads.delete(standard)
      return dataset
    })
    .catch((error: unknown) => {
      pendingLoads.delete(standard)
      throw error
    })

  pendingLoads.set(standard, nextLoad)
  return nextLoad
}

export async function loadStandard(standard: Standard): Promise<void> {
  await getStandardDataset(standard)
}

export function getIndicatorData(dataset: StandardDataset, indicator: Indicator): StandardIndicatorData | null {
  return dataset.indicators[indicator] ?? null
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

export function __resetStandardDataForTest(): void {
  cache.clear()
  pendingLoads.clear()
  loaders.clear()

  for (const [standard, loader] of Object.entries(defaultLoaders) as [Standard, () => Promise<StandardDataset>][]) {
    loaders.set(standard, loader)
  }
}

export function __setStandardLoaderForTest(
  standard: Standard,
  loader: () => Promise<StandardDataset>
): void {
  cache.delete(standard)
  pendingLoads.delete(standard)
  loaders.set(standard, loader)
}
