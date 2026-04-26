import { useEffect, useState } from 'react'

import { renderChart, type Sex, type Standard } from '@groowooth/core'

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
  const chartMarkup = renderChart({
    standard,
    indicator,
    sex,
    measurements: sortedMeasurements,
    locale: 'zh-CN',
    theme
  })

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
        dangerouslySetInnerHTML={{ __html: chartMarkup }}
      />
    </article>
  )
}
