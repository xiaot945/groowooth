import { useEffect, useState } from 'react'
import type { Indicator } from '@groowooth/core'

import { deleteMeasurement, resetAllData } from '../lib/storage'
import type { ChildRecord, MeasurementRecord } from '../lib/storage'
import { formatDateLabel } from '../lib/format'
import { ChartCard } from './ChartCard'
import { ChildHeader } from './ChildHeader'
import { ChildSwitcher } from './ChildSwitcher'
import { MeasurementList } from './MeasurementList'
import { MeasurementForm } from './MeasurementForm'
import { ResetButton } from './ResetButton'

interface DashboardProps {
  activeChildId: string
  child: ChildRecord
  measurements: MeasurementRecord[]
  onMeasurementsChanged: () => Promise<void>
}

type AgeIndicator = 'height-for-age' | 'weight-for-age' | 'bmi-for-age' | 'head-for-age'

interface LatestSummary {
  date: string
  messages: string[]
  disclaimer: string
}

const STANDARD = 'nhc-2022'
const DEFAULT_DISCLAIMER = '本结果仅为统计参考，不构成医疗建议；如有疑虑请咨询儿科医生。'
const SUMMARY_INDICATORS: AgeIndicator[] = [
  'height-for-age',
  'weight-for-age',
  'bmi-for-age',
  'head-for-age'
]

function buildChartMeasurements(
  measurements: MeasurementRecord[],
  indicator: AgeIndicator
): Array<{ date: string; x: number; value: number }> {
  if (indicator === 'height-for-age') {
    return measurements
      .filter((record) => record.heightCm !== undefined)
      .map((record) => ({
        date: record.date,
        x: record.ageMonths,
        value: record.heightCm as number
      }))
  }

  if (indicator === 'weight-for-age') {
    return measurements
      .filter((record) => record.weightKg !== undefined)
      .map((record) => ({
        date: record.date,
        x: record.ageMonths,
        value: record.weightKg as number
      }))
  }

  if (indicator === 'head-for-age') {
    return measurements
      .filter((record) => record.headCircumferenceCm !== undefined)
      .map((record) => ({
        date: record.date,
        x: record.ageMonths,
        value: record.headCircumferenceCm as number
      }))
  }

  return measurements
    .filter((record) => record.heightCm !== undefined && record.weightKg !== undefined)
    .map((record) => ({
      date: record.date,
      x: record.ageMonths,
      value: record.weightKg! / Math.pow(record.heightCm! / 100, 2)
    }))
}

function isSummaryIndicator(indicator: Indicator): indicator is AgeIndicator {
  return SUMMARY_INDICATORS.includes(indicator as AgeIndicator)
}

async function buildLatestSummary(child: ChildRecord, measurements: MeasurementRecord[]): Promise<LatestSummary | null> {
  const latest = [...measurements].sort((left, right) => right.date.localeCompare(left.date))[0]

  if (!latest) {
    return null
  }

  let disclaimer = DEFAULT_DISCLAIMER

  try {
    const { DISCLAIMER, assess, interpret } = await import('@groowooth/core')
    disclaimer = DISCLAIMER

    const assessment = await assess({
      standard: STANDARD,
      ageMonths: latest.ageMonths,
      sex: child.sex,
      heightCm: latest.heightCm,
      weightKg: latest.weightKg,
      headCircumferenceCm: latest.headCircumferenceCm
    })

    const messages = await Promise.all(
      assessment.assessments
        .filter((entry) => isSummaryIndicator(entry.indicator))
        .map(async (entry) =>
          (
            await interpret({
              standard: STANDARD,
              zScore: entry.zScore,
              indicator: entry.indicator,
              ageMonths: latest.ageMonths,
              sex: child.sex
            })
          ).description
        )
    )

    return {
      date: latest.date,
      messages,
      disclaimer: assessment.disclaimer
    }
  } catch {
    return {
      date: latest.date,
      messages: ['本次记录已保存，但暂时无法生成统计解读。'],
      disclaimer
    }
  }
}

export function Dashboard({ activeChildId, child, measurements, onMeasurementsChanged }: DashboardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isChildSwitcherOpen, setIsChildSwitcherOpen] = useState(false)
  const [latestSummary, setLatestSummary] = useState<LatestSummary | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)

  useEffect(() => {
    void import('@groowooth/core')
      .then(({ loadStandard }) => loadStandard(STANDARD))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (measurements.length === 0) {
      setLatestSummary(null)
      setIsSummaryLoading(false)
      return
    }

    let isCancelled = false

    setLatestSummary(null)
    setIsSummaryLoading(true)

    void buildLatestSummary(child, measurements).then((summary) => {
      if (!isCancelled) {
        setLatestSummary(summary)
        setIsSummaryLoading(false)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [activeChildId, child, measurements])

  useEffect(() => {
    setIsFormOpen(false)
    setIsChildSwitcherOpen(false)
  }, [activeChildId])

  const chartCards = SUMMARY_INDICATORS.map((indicator) => ({
    indicator,
    measurements: buildChartMeasurements(measurements, indicator)
  }))
  const nonEmptyCards = chartCards.filter((card) => card.measurements.length > 0)
  const visibleCards =
    nonEmptyCards.length > 0 ? nonEmptyCards : chartCards.filter((card) => card.indicator !== 'bmi-for-age')

  async function handleSaved(_record: MeasurementRecord) {
    await onMeasurementsChanged()
    setIsFormOpen(false)
  }

  async function handleDeleteMeasurement(date: string) {
    await deleteMeasurement(child.id, date)
    await onMeasurementsChanged()
  }

  async function handleResetAllData() {
    await resetAllData()
    window.location.reload()
  }

  return (
    <main className="app-shell">
      <div className="dashboard">
        <ChildHeader child={child} onOpenSwitcher={() => setIsChildSwitcherOpen(true)} />

        {isSummaryLoading ? (
          <section className="surface-card insight-card" aria-live="polite" aria-busy="true">
            <p className="eyebrow">最近一次记录</p>
            <h2>正在生成统计解读…</h2>
            <p className="helper-text">记录已保存，正在按 NHC 2022 标准计算。</p>
          </section>
        ) : latestSummary ? (
          <section className="surface-card insight-card" aria-live="polite">
            <p className="eyebrow">最近一次记录</p>
            <h2>{formatDateLabel(latestSummary.date)}</h2>
            {latestSummary.messages.map((message) => (
              <p key={message} className="insight-card__message">
                {message}
              </p>
            ))}
            <p className="helper-text">{latestSummary.disclaimer}</p>
          </section>
        ) : (
          <section className="surface-card empty-card">
            <p className="eyebrow">还没有记录</p>
            <h2>先记一次身高、体重或头围</h2>
            <p className="lead">保存后会立刻出现对应的成长曲线图。身高和体重同一天都有时，还会自动生成 BMI 曲线。</p>
          </section>
        )}

        <section className="dashboard-grid" aria-label="成长曲线图表">
          {visibleCards.map((card) => (
            <ChartCard
              key={card.indicator}
              indicator={card.indicator}
              measurements={card.measurements}
              sex={child.sex}
              standard={STANDARD}
            />
          ))}
        </section>

        <MeasurementList
          measurements={measurements}
          childBirthDate={child.dateOfBirth}
          onDelete={handleDeleteMeasurement}
        />

        <ResetButton onConfirm={handleResetAllData} />

        <button
          className="fab-button"
          type="button"
          aria-label="新增测量记录"
          onClick={() => setIsFormOpen(true)}
        >
          + 记录
        </button>

        {isFormOpen ? (
          <MeasurementForm child={child} onCancel={() => setIsFormOpen(false)} onSaved={handleSaved} />
        ) : null}

        {isChildSwitcherOpen ? (
          <ChildSwitcher
            activeChildId={activeChildId}
            onClose={() => setIsChildSwitcherOpen(false)}
            onChildChanged={onMeasurementsChanged}
          />
        ) : null}
      </div>
    </main>
  )
}
