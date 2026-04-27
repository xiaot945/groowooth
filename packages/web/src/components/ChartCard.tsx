import { useEffect, useState } from 'react'

import { OutOfRangeError, type Sex, type Standard } from '@groowooth/core'

import { getStandardAgeRange } from '../lib/standard-bounds'

type AgeIndicator = 'height-for-age' | 'weight-for-age' | 'bmi-for-age' | 'head-for-age'

interface ChartPoint {
  date: string
  x: number
  value: number
}

interface ChartCardProps {
  indicator: AgeIndicator
  measurements: ChartPoint[]
  sex: Sex
  standard: Standard
}

interface ChartNotice {
  title: string
  body: string
}

interface ChartRequest {
  standard: Standard
  indicator: AgeIndicator
  sex: Sex
  measurements: ChartPoint[]
  locale: 'zh-CN'
  theme: 'light' | 'dark'
}

function indicatorLabel(indicator: AgeIndicator): string {
  switch (indicator) {
    case 'height-for-age':
      return '身高'
    case 'weight-for-age':
      return '体重'
    case 'bmi-for-age':
      return 'BMI'
    case 'head-for-age':
      return '头围'
  }
}

function useChartTheme(): 'light' | 'dark' {
  const isDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches

  const [theme, setTheme] = useState<'light' | 'dark'>(isDark ? 'dark' : 'light')

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light')
    }

    setTheme(mediaQuery.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return theme
}

function toChartErrorMessage(): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return '离线状态下首次打开无法加载标准曲线，请联网后重试'
  }

  return '图表加载失败，请稍后重试。'
}

function formatAgeMonths(ageMonths: number): string {
  return Number.isInteger(ageMonths) ? String(ageMonths) : ageMonths.toFixed(1).replace(/\.0$/, '')
}

function buildUnsupportedAgeNotice(minAgeMonths: number, maxAgeMonths: number): ChartNotice {
  return {
    title: '该标准不适用于当前年龄',
    body: `已记录的年龄超出该标准覆盖范围（${formatAgeMonths(minAgeMonths)}–${formatAgeMonths(maxAgeMonths)} 个月）`
  }
}

function buildUnsupportedIndicatorNotice(): ChartNotice {
  return {
    title: '该标准不提供该指标的曲线',
    body: '请切换其他参考标准查看该指标图表。'
  }
}

export function ChartCard({ indicator, measurements, sex, standard }: ChartCardProps) {
  const theme = useChartTheme()
  const sortedMeasurements = [...measurements].sort((left, right) => left.x - right.x)
  const chartRequest: ChartRequest = {
    standard,
    indicator,
    sex,
    measurements: sortedMeasurements,
    locale: 'zh-CN' as const,
    theme
  }
  const chartRequestKey = JSON.stringify(chartRequest)
  const [chartMarkup, setChartMarkup] = useState<string | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [chartNotice, setChartNotice] = useState<ChartNotice | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (chartRequest.measurements.length === 0) {
      setChartMarkup(null)
      setChartError(null)
      setChartNotice(null)
      return
    }

    let isCancelled = false
    setChartMarkup(null)
    setChartError(null)
    setChartNotice(null)

    async function loadChart() {
      try {
        const ageRange = await getStandardAgeRange(standard, indicator, sex)

        if (!ageRange) {
          if (!isCancelled) {
            setChartNotice(buildUnsupportedIndicatorNotice())
          }
          return
        }

        if (
          chartRequest.measurements.some(
            (measurement) =>
              measurement.x < ageRange.minAgeMonths || measurement.x > ageRange.maxAgeMonths
          )
        ) {
          if (!isCancelled) {
            setChartNotice(buildUnsupportedAgeNotice(ageRange.minAgeMonths, ageRange.maxAgeMonths))
          }
          return
        }

        const { renderChart } = await import('@groowooth/core')
        const svg = await renderChart(chartRequest)

        if (!isCancelled) {
          setChartMarkup(svg)
        }
      } catch (error) {
        if (error instanceof OutOfRangeError) {
          const ageRange = await getStandardAgeRange(standard, indicator, sex)

          if (isCancelled) {
            return
          }

          if (!ageRange) {
            setChartNotice(buildUnsupportedIndicatorNotice())
            return
          }

          setChartNotice(buildUnsupportedAgeNotice(ageRange.minAgeMonths, ageRange.maxAgeMonths))
          return
        }

        if (!isCancelled) {
          setChartError(toChartErrorMessage())
        }
      }
    }

    void loadChart()

    return () => {
      isCancelled = true
    }
  }, [chartRequestKey, retryToken])

  if (sortedMeasurements.length === 0) {
    return (
      <article className="surface-card chart-card">
        <div className="chart-card__header">
          <div>
            <h2>{indicatorLabel(indicator)}</h2>
            <p className="muted-text">还没有 {indicatorLabel(indicator)} 数据</p>
          </div>
        </div>
      </article>
    )
  }

  const latestMeasurement = sortedMeasurements[sortedMeasurements.length - 1]

  return (
    <article className="surface-card chart-card">
      <div className="chart-card__header">
        <div>
          <h2>{indicatorLabel(indicator)}</h2>
          <p className="muted-text">
            已记录 {sortedMeasurements.length} 次 · 最新点 {latestMeasurement.value}
          </p>
        </div>
      </div>
      <div
        className="chart-card__graphic"
        aria-busy={chartMarkup === null && chartError === null && chartNotice === null}
      >
        {chartMarkup ? (
          <div dangerouslySetInnerHTML={{ __html: chartMarkup }} />
        ) : (
          <div
            className="chart-card__placeholder"
            role={chartError ? 'alert' : 'status'}
            aria-live="polite"
          >
            {chartNotice ? null : <div className="chart-card__skeleton" aria-hidden="true" />}
            {chartNotice ? <p>{chartNotice.title}</p> : null}
            <p className="muted-text">{chartNotice?.body ?? chartError ?? '正在加载…'}</p>
            {chartError ? (
              <div className="chart-card__actions">
                <button
                  type="button"
                  className="ghost-button chart-card__retry"
                  onClick={() => setRetryToken((current) => current + 1)}
                >
                  重试
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </article>
  )
}
