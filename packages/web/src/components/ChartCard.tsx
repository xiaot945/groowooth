import { useEffect, useState } from 'react'

import type { Sex, Standard } from '@groowooth/core'

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

  useEffect(() => {
    if (chartRequest.measurements.length === 0) {
      setChartMarkup(null)
      setChartError(null)
      return
    }

    let isCancelled = false
    setChartMarkup(null)
    setChartError(null)

    void import('@groowooth/core')
      .then(({ renderChart }) => renderChart(chartRequest))
      .then((svg) => {
        if (!isCancelled) {
          setChartMarkup(svg)
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setChartError(error instanceof Error ? error.message : '图表加载失败，请稍后重试。')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [chartRequestKey])

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
        aria-busy={chartMarkup === null && chartError === null}
      >
        {chartMarkup ? (
          <div dangerouslySetInnerHTML={{ __html: chartMarkup }} />
        ) : (
          <div
            className="chart-card__placeholder"
            role={chartError ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className="chart-card__skeleton" aria-hidden="true" />
            <p className="muted-text">{chartError ?? '正在加载…'}</p>
          </div>
        )}
      </div>
    </article>
  )
}
