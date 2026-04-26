import { lookup, type CurveData, type LookupPoint } from './lookup'
import { getStandardDataset } from './standard-data'
import { DISCLAIMER, type Indicator, type Sex, type Standard } from './types'

export interface ChartMeasurement {
  /** ISO date string or unix ms; only used for tooltip labels */
  date?: string
  /** x-axis position (months for age-based, cm for size-based) */
  x: number
  /** y-axis value */
  value: number
}

export interface RenderChartOptions {
  standard: Standard
  indicator: Indicator
  sex: Sex
  /** child's measurement points (sorted by x ascending preferred but not required) */
  measurements: ChartMeasurement[]
  /** SVG canvas size in px */
  width?: number
  height?: number
  /** percentile bands to draw; default [3, 15, 50, 85, 97] */
  percentiles?: number[]
  /** if specified, restrict x-axis range; else auto from measurements + a bit of padding */
  xRange?: [number, number]
  /** chart locale; v1 supports 'zh-CN' (default) and 'en' */
  locale?: 'zh-CN' | 'en'
  /** color scheme; v1 supports 'light' (default) and 'dark' */
  theme?: 'light' | 'dark'
}

interface ThemePalette {
  background: string
  panel: string
  grid: string
  axis: string
  text: string
  mutedText: string
  bandFill: string
  p50: string
  percentile: string
  percentileOuter: string
  markerFill: string
  markerStroke: string
}

interface ChartLabels {
  title: string
  summary: string
  xAxis: string
  yAxis: string
}

interface NormalizedMeasurement {
  measurement: ChartMeasurement
  clampedX: number
  isClipped: boolean
}

const DEFAULT_WIDTH = 720
const DEFAULT_HEIGHT = 480
const DEFAULT_PERCENTILES = [3, 15, 50, 85, 97] as const
const MIN_TICKS = 2

const THEME_PALETTES: Record<'light' | 'dark', ThemePalette> = {
  light: {
    background: '#F3F8F5',
    panel: '#FFFFFF',
    grid: '#D7E2DD',
    axis: '#7A9089',
    text: '#17312A',
    mutedText: '#4C6760',
    bandFill: '#BFE3D7',
    p50: '#2E7D69',
    percentile: '#5A95A2',
    percentileOuter: '#8CB5BE',
    markerFill: '#4D8DB1',
    markerStroke: '#FFFFFF'
  },
  dark: {
    background: '#12201C',
    panel: '#19302A',
    grid: '#36514A',
    axis: '#98B2AB',
    text: '#EFF7F4',
    mutedText: '#C6D8D2',
    bandFill: '#2D5F51',
    p50: '#94D5B7',
    percentile: '#7FB9C5',
    percentileOuter: '#5C8992',
    markerFill: '#92C8E6',
    markerStroke: '#163028'
  }
}

function percentileKey(percentile: number): string {
  return `p${percentile}`
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const rounded = value.toFixed(maximumFractionDigits)
  return rounded.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')
}

function formatFixed(value: number): string {
  return formatNumber(value, 2)
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function uniqueSortedPercentiles(percentiles?: number[]): number[] {
  const values = percentiles && percentiles.length > 0 ? percentiles : [...DEFAULT_PERCENTILES]
  return [...new Set(values)].sort((left, right) => left - right)
}

function indicatorLabel(indicator: Indicator, locale: 'zh-CN' | 'en'): string {
  switch (indicator) {
    case 'height-for-age':
      return locale === 'en' ? 'Height' : '身高'
    case 'weight-for-age':
      return locale === 'en' ? 'Weight' : '体重'
    case 'bmi-for-age':
      return 'BMI'
    case 'head-for-age':
      return locale === 'en' ? 'Head Circumference' : '头围'
    case 'weight-for-length':
      return locale === 'en' ? 'Weight for Length' : '身长别体重'
    case 'weight-for-height':
      return locale === 'en' ? 'Weight for Height' : '身高别体重'
  }
}

function sexLabel(sex: Sex, locale: 'zh-CN' | 'en'): string {
  if (locale === 'en') {
    return sex === 'male' ? 'Boy' : 'Girl'
  }

  return sex === 'male' ? '男童' : '女童'
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

function valueUnit(indicator: Indicator): string {
  switch (indicator) {
    case 'height-for-age':
    case 'head-for-age':
      return 'cm'
    case 'weight-for-age':
    case 'weight-for-length':
    case 'weight-for-height':
      return 'kg'
    case 'bmi-for-age':
      return 'kg/m²'
  }
}

function xAxisLabel(curveData: CurveData, locale: 'zh-CN' | 'en'): string {
  if (curveData.xType === 'age') {
    return locale === 'en' ? 'Age (months)' : '月龄（月）'
  }

  if (curveData.xType === 'length') {
    return locale === 'en' ? 'Length (cm)' : '身长（cm）'
  }

  return locale === 'en' ? 'Height (cm)' : '身高（cm）'
}

function yAxisLabel(indicator: Indicator, locale: 'zh-CN' | 'en'): string {
  const label = indicatorLabel(indicator, locale)
  return `${label} (${valueUnit(indicator)})`
}

function buildLabels(
  curveData: CurveData,
  locale: 'zh-CN' | 'en',
  measurementCount: number
): ChartLabels {
  const dataset = getStandardDataset(curveData.standard)
  const title = `${sexLabel(curveData.sex, locale)} ${indicatorLabel(curveData.indicator, locale)} (${standardLabel(curveData.standard)})`
  const summary =
    locale === 'en'
      ? `${title}. ${measurementCount} measurement${measurementCount === 1 ? '' : 's'} plotted. Source: ${dataset.source}.`
      : `${title}，展示 ${measurementCount} 条测量记录。数据来源：${dataset.source}。`

  return {
    title,
    summary,
    xAxis: xAxisLabel(curveData, locale),
    yAxis: yAxisLabel(curveData.indicator, locale)
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function getCurveDomain(curveData: CurveData): [number, number] {
  const allPoints = Object.values(curveData.curves).flat()

  if (allPoints.length === 0) {
    return [0, 1]
  }

  const values = allPoints.map((point) => point.x)
  return [Math.min(...values), Math.max(...values)]
}

function normalizeRange(range: [number, number]): [number, number] {
  const start = Number.isFinite(range[0]) ? range[0] : 0
  const end = Number.isFinite(range[1]) ? range[1] : 1
  const min = Math.min(start, end)
  const max = Math.max(start, end)

  if (min === max) {
    return [min - 0.5, max + 0.5]
  }

  return [min, max]
}

function resolveXRange(
  explicitRange: [number, number] | undefined,
  measurements: ChartMeasurement[],
  datasetRange: [number, number]
): [number, number] {
  if (explicitRange) {
    return normalizeRange(explicitRange)
  }

  if (measurements.length === 0) {
    return datasetRange
  }

  const xs = measurements.map((measurement) => measurement.x)
  const rawMin = Math.min(...xs)
  const rawMax = Math.max(...xs)
  const span = rawMax - rawMin
  const datasetSpan = datasetRange[1] - datasetRange[0]
  const padding = span > 0 ? span * 0.1 : Math.max(datasetSpan * 0.08, 1)
  const requested: [number, number] = [rawMin - padding, rawMax + padding]
  const clamped: [number, number] = [
    clamp(requested[0], datasetRange[0], datasetRange[1]),
    clamp(requested[1], datasetRange[0], datasetRange[1])
  ]

  if (clamped[0] >= clamped[1]) {
    return datasetRange
  }

  return clamped
}

function getYRange(curveData: CurveData, measurements: ChartMeasurement[]): [number, number] {
  const values = Object.values(curveData.curves)
    .flat()
    .map((point) => point.value)
    .concat(measurements.map((measurement) => measurement.value))
    .filter(Number.isFinite)

  if (values.length === 0) {
    return [0, 1]
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum
  const padding = span > 0 ? span * 0.05 : Math.max(Math.abs(maximum) * 0.05, 1)

  return [minimum - padding, maximum + padding]
}

function niceStep(roughStep: number): number {
  if (!Number.isFinite(roughStep) || roughStep <= 0) {
    return 1
  }

  const exponent = Math.floor(Math.log10(roughStep))
  const base = 10 ** exponent
  const fraction = roughStep / base

  if (fraction <= 1) {
    return base
  }
  if (fraction <= 2) {
    return 2 * base
  }
  if (fraction <= 5) {
    return 5 * base
  }

  return 10 * base
}

function createTicks(minimum: number, maximum: number, targetCount = 6): number[] {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return [0, 1]
  }

  if (minimum === maximum) {
    return [minimum]
  }

  const step = niceStep((maximum - minimum) / Math.max(targetCount - 1, 1))
  const first = Math.ceil(minimum / step) * step
  const ticks: number[] = []

  for (let value = first; value <= maximum + step * 0.5; value += step) {
    ticks.push(Number(value.toFixed(10)))
  }

  if (ticks.length < MIN_TICKS) {
    return [minimum, maximum]
  }

  return ticks
}

function tickPrecision(ticks: number[]): number {
  if (ticks.length < 2) {
    return 0
  }

  const step = Math.abs(ticks[1] - ticks[0])
  if (step < 1) {
    return 2
  }
  if (step < 10) {
    return 1
  }
  return 0
}

function formatTick(value: number, precision: number, locale: 'zh-CN' | 'en'): string {
  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en' : 'zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  })

  return formatter.format(value)
}

function formatXTick(
  value: number,
  precision: number,
  curveData: CurveData,
  locale: 'zh-CN' | 'en'
): string {
  const formatted = formatTick(value, precision, locale)

  if (curveData.xUnit === 'months') {
    return locale === 'en' ? `${formatted} mo` : `${formatted}月`
  }

  return `${formatted} cm`
}

function createPath(points: LookupPoint[], mapX: (value: number) => number, mapY: (value: number) => number): string {
  if (points.length === 0) {
    return ''
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${formatFixed(mapX(point.x))} ${formatFixed(mapY(point.value))}`)
    .join(' ')
}

function createBandPath(
  lowerPoints: LookupPoint[],
  upperPoints: LookupPoint[],
  mapX: (value: number) => number,
  mapY: (value: number) => number
): string {
  if (lowerPoints.length === 0 || upperPoints.length === 0) {
    return ''
  }

  const top = createPath(upperPoints, mapX, mapY)
  const bottom = [...lowerPoints]
    .reverse()
    .map((point) => `L ${formatFixed(mapX(point.x))} ${formatFixed(mapY(point.value))}`)
    .join(' ')

  return `${top} ${bottom} Z`
}

function formatDate(date: string, locale: 'zh-CN' | 'en'): string {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.valueOf())) {
    return date
  }

  return new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsed)
}

function formatMeasurementTitle(
  measurement: ChartMeasurement,
  curveData: CurveData,
  locale: 'zh-CN' | 'en'
): string {
  const parts: string[] = []

  if (measurement.date) {
    parts.push(formatDate(measurement.date, locale))
  }

  const formattedX = formatNumber(measurement.x)
  const xPart =
    curveData.xUnit === 'months'
      ? locale === 'en'
        ? `${formattedX} mo`
        : `${formattedX}月`
      : `${formattedX} cm`

  const yPart = `${formatNumber(measurement.value)} ${valueUnit(curveData.indicator)}`

  if (locale === 'en') {
    parts.push(`${xPart}`)
    parts.push(`${indicatorLabel(curveData.indicator, locale)} ${yPart}`)
  } else {
    parts.push(`${xPart}`)
    parts.push(`${indicatorLabel(curveData.indicator, locale)} ${yPart}`)
  }

  return parts.join(' · ')
}

function normalizeMeasurements(
  measurements: ChartMeasurement[],
  xRange: [number, number]
): NormalizedMeasurement[] {
  return measurements
    .filter((measurement) => Number.isFinite(measurement.x) && Number.isFinite(measurement.value))
    .map((measurement) => {
      const clampedX = clamp(measurement.x, xRange[0], xRange[1])
      return {
        measurement,
        clampedX,
        isClipped: clampedX !== measurement.x
      }
    })
}

function buildStyles(palette: ThemePalette): string {
  return `
    .chart-shell { fill: ${palette.panel}; }
    .chart-grid { stroke: ${palette.grid}; stroke-width: 1; }
    .chart-axis { stroke: ${palette.axis}; stroke-width: 1.5; }
    .chart-label, .chart-tick { fill: ${palette.mutedText}; font-size: 13px; }
    .chart-title { fill: ${palette.text}; font-size: 24px; font-weight: 700; letter-spacing: 0.01em; }
    .chart-disclaimer { fill: ${palette.mutedText}; font-size: 12px; }
    .percentile-band { fill: ${palette.bandFill}; fill-opacity: 0.38; stroke: none; }
    .percentile-line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .percentile-line--default { stroke: ${palette.percentile}; stroke-width: 2.25; }
    .percentile-line--median { stroke: ${palette.p50}; stroke-width: 3.5; }
    .percentile-line--outer { stroke: ${palette.percentileOuter}; stroke-width: 1.6; }
    .measurement-point { fill: ${palette.markerFill}; stroke: ${palette.markerStroke}; stroke-width: 2.25; }
    .measurement-point--clipped { stroke-width: 2.5; stroke-dasharray: 3 2; }
  `
}

export function renderChart(options: RenderChartOptions): string {
  const locale = options.locale ?? 'zh-CN'
  const theme = options.theme ?? 'light'
  const width = options.width ?? DEFAULT_WIDTH
  const height = options.height ?? DEFAULT_HEIGHT
  const requestedPercentiles = uniqueSortedPercentiles(options.percentiles)
  const lookupPercentiles = uniqueSortedPercentiles([...requestedPercentiles, 15, 85])
  const palette = THEME_PALETTES[theme]
  const margins = { top: 76, right: 28, bottom: 84, left: 76 }
  const plotWidth = Math.max(width - margins.left - margins.right, 120)
  const plotHeight = Math.max(height - margins.top - margins.bottom, 120)

  const baseLookup = lookup({
    standard: options.standard,
    indicator: options.indicator,
    sex: options.sex,
    percentiles: lookupPercentiles
  })

  const datasetRange = getCurveDomain(baseLookup)
  const xRange = resolveXRange(options.xRange, options.measurements, datasetRange)
  const curveData =
    xRange[0] === datasetRange[0] && xRange[1] === datasetRange[1]
      ? baseLookup
      : lookup({
          standard: options.standard,
          indicator: options.indicator,
          sex: options.sex,
          percentiles: lookupPercentiles,
          xRange
        })

  const normalizedMeasurements = normalizeMeasurements(options.measurements, xRange)
  const yRange = getYRange(
    curveData,
    normalizedMeasurements.map((entry) => entry.measurement)
  )
  const labels = buildLabels(curveData, locale, normalizedMeasurements.length)
  const xTicks = createTicks(xRange[0], xRange[1])
  const yTicks = createTicks(yRange[0], yRange[1])
  const xPrecision = tickPrecision(xTicks)
  const yPrecision = tickPrecision(yTicks)

  const mapX = (value: number): number => margins.left + ((value - xRange[0]) / (xRange[1] - xRange[0])) * plotWidth
  const mapY = (value: number): number =>
    margins.top + plotHeight - ((value - yRange[0]) / (yRange[1] - yRange[0])) * plotHeight

  const bandPath = createBandPath(
    curveData.curves[percentileKey(15)] ?? [],
    curveData.curves[percentileKey(85)] ?? [],
    mapX,
    mapY
  )

  const percentilePaths = requestedPercentiles
    .map((percentile) => {
      const curve = curveData.curves[percentileKey(percentile)] ?? []
      const path = createPath(curve, mapX, mapY)

      if (!path) {
        return ''
      }

      const modifier =
        percentile === 50 ? 'percentile-line--median' : percentile === 3 || percentile === 97 ? 'percentile-line--outer' : 'percentile-line--default'

      return `<path class="percentile-line ${modifier}" data-percentile="${formatNumber(percentile)}" d="${path}" />`
    })
    .filter(Boolean)
    .join('\n')

  const markerRadius = normalizedMeasurements.length === 1 ? 7.5 : 6.5
  const markers = normalizedMeasurements
    .map(({ measurement, clampedX, isClipped }) => {
      const title = escapeXml(formatMeasurementTitle(measurement, curveData, locale))
      const className = `measurement-point${isClipped ? ' measurement-point--clipped' : ''}`
      return `<circle class="${className}" cx="${formatFixed(mapX(clampedX))}" cy="${formatFixed(
        mapY(measurement.value)
      )}" r="${formatFixed(markerRadius)}"><title>${title}</title></circle>`
    })
    .join('\n')

  const xAxisY = margins.top + plotHeight
  const yAxisX = margins.left
  const xGrid = xTicks
    .map((tick) => {
      const x = mapX(tick)
      return `<g><line class="chart-grid" x1="${formatFixed(x)}" y1="${formatFixed(margins.top)}" x2="${formatFixed(
        x
      )}" y2="${formatFixed(xAxisY)}" /><text class="chart-tick" x="${formatFixed(x)}" y="${formatFixed(
        xAxisY + 24
      )}" text-anchor="middle">${escapeXml(formatXTick(tick, xPrecision, curveData, locale))}</text></g>`
    })
    .join('\n')
  const yGrid = yTicks
    .map((tick) => {
      const y = mapY(tick)
      return `<g><line class="chart-grid" x1="${formatFixed(yAxisX)}" y1="${formatFixed(y)}" x2="${formatFixed(
        yAxisX + plotWidth
      )}" y2="${formatFixed(y)}" /><text class="chart-tick" x="${formatFixed(yAxisX - 12)}" y="${formatFixed(
        y + 4
      )}" text-anchor="end">${escapeXml(formatTick(tick, yPrecision, locale))}</text></g>`
    })
    .join('\n')

  const styleBlock = buildStyles(palette)
  const titleId = 'groowooth-chart-title'
  const descId = 'groowooth-chart-desc'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(width, 0)}" height="${formatNumber(
    height,
    0
  )}" viewBox="0 0 ${formatNumber(width, 0)} ${formatNumber(height, 0)}" role="img" aria-labelledby="${titleId} ${descId}" style="background:${palette.background};font-family:&quot;Avenir Next&quot;,&quot;PingFang SC&quot;,&quot;Hiragino Sans GB&quot;,&quot;Noto Sans SC&quot;,&quot;Segoe UI&quot;,sans-serif;">
  <title id="${titleId}">${escapeXml(labels.title)}</title>
  <desc id="${descId}">${escapeXml(labels.summary)}</desc>
  <style>${styleBlock}</style>
  <rect x="0" y="0" width="${formatNumber(width, 0)}" height="${formatNumber(height, 0)}" rx="24" fill="${palette.background}" />
  <rect class="chart-shell" x="16" y="16" width="${formatNumber(width - 32, 0)}" height="${formatNumber(height - 32, 0)}" rx="22" />
  <text class="chart-title" x="${formatFixed(margins.left)}" y="46">${escapeXml(labels.title)}</text>
  <text class="chart-label" x="${formatFixed(margins.left)}" y="66">${escapeXml(labels.yAxis)}</text>
  ${xGrid}
  ${yGrid}
  <line class="chart-axis" x1="${formatFixed(yAxisX)}" y1="${formatFixed(margins.top)}" x2="${formatFixed(yAxisX)}" y2="${formatFixed(
    xAxisY
  )}" />
  <line class="chart-axis" x1="${formatFixed(yAxisX)}" y1="${formatFixed(xAxisY)}" x2="${formatFixed(
    yAxisX + plotWidth
  )}" y2="${formatFixed(xAxisY)}" />
  ${bandPath ? `<path class="percentile-band" d="${bandPath}" />` : ''}
  ${percentilePaths}
  ${markers}
  <text class="chart-label" x="${formatFixed(margins.left + plotWidth / 2)}" y="${formatFixed(
    height - 42
  )}" text-anchor="middle">${escapeXml(labels.xAxis)}</text>
  <text class="chart-disclaimer" x="${formatFixed(margins.left)}" y="${formatFixed(height - 18)}">${escapeXml(
    DISCLAIMER
  )}</text>
</svg>`
}
