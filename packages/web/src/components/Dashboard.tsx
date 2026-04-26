import { assess, interpret, DISCLAIMER, type Indicator } from '@groowooth/core'
import { useState } from 'react'

import { deleteMeasurement, resetAllData } from '../lib/storage'
import type { ChildRecord, MeasurementRecord } from '../lib/storage'
import { formatDateLabel } from '../lib/format'
import { ChartCard } from './ChartCard'
import { ChildHeader } from './ChildHeader'
import { MeasurementList } from './MeasurementList'
import { MeasurementForm } from './MeasurementForm'
import { ResetButton } from './ResetButton'

interface DashboardProps {
  child: ChildRecord
  measurements: MeasurementRecord[]
  onMeasurementsChanged: () => Promise<void>
}

type AgeIndicator = 'height-for-age' | 'weight-for-age' | 'bmi-for-age' | 'head-for-age'

const STANDARD = 'nhc-2022'
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

function buildLatestSummary(child: ChildRecord, measurements: MeasurementRecord[]) {
  const latest = [...measurements].sort((left, right) => right.date.localeCompare(left.date))[0]

  if (!latest) {
    return null
  }

  try {
    const assessment = assess({
      standard: STANDARD,
      ageMonths: latest.ageMonths,
      sex: child.sex,
      heightCm: latest.heightCm,
      weightKg: latest.weightKg,
      headCircumferenceCm: latest.headCircumferenceCm
    })

    const messages = assessment.assessments
      .filter((entry) => isSummaryIndicator(entry.indicator))
      .map((entry) =>
        interpret({
          standard: STANDARD,
          zScore: entry.zScore,
          indicator: entry.indicator,
          ageMonths: latest.ageMonths,
          sex: child.sex
        }).description
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
      disclaimer: DISCLAIMER
    }
  }
}

export function Dashboard({ child, measurements, onMeasurementsChanged }: DashboardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const chartCards = SUMMARY_INDICATORS.map((indicator) => ({
    indicator,
    measurements: buildChartMeasurements(measurements, indicator)
  }))
  const nonEmptyCards = chartCards.filter((card) => card.measurements.length > 0)
  const visibleCards =
    nonEmptyCards.length > 0 ? nonEmptyCards : chartCards.filter((card) => card.indicator !== 'bmi-for-age')
  const latestSummary = buildLatestSummary(child, measurements)

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
        <ChildHeader child={child} />

        {latestSummary ? (
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
      </div>
    </main>
  )
}
