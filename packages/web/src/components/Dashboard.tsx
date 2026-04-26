import { useEffect, useRef, useState } from 'react'
import type { Indicator } from '@groowooth/core'

import {
  addMeasurement,
  deleteMeasurement,
  MeasurementConflictError,
  MeasurementMissingError,
  resetAllData,
  updateMeasurement
} from '../lib/storage'
import type { ChildRecord, MeasurementRecord } from '../lib/storage'
import { ageInMonths } from '../lib/age'
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
  const [editingMeasurement, setEditingMeasurement] = useState<MeasurementRecord | null>(null)
  const [measurementFormError, setMeasurementFormError] = useState<string | null>(null)
  const [isChildSwitcherOpen, setIsChildSwitcherOpen] = useState(false)
  const [latestSummary, setLatestSummary] = useState<LatestSummary | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const closeEditTimeoutRef = useRef<number | null>(null)

  function clearPendingEditClose() {
    if (closeEditTimeoutRef.current !== null) {
      window.clearTimeout(closeEditTimeoutRef.current)
      closeEditTimeoutRef.current = null
    }
  }

  useEffect(() => {
    void import('@groowooth/core')
      .then(({ loadStandard }) => loadStandard(STANDARD))
      .catch(() => {})
  }, [])

  useEffect(() => () => clearPendingEditClose(), [])

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
    clearPendingEditClose()
    setIsFormOpen(false)
    setEditingMeasurement(null)
    setMeasurementFormError(null)
    setIsChildSwitcherOpen(false)
  }, [activeChildId])

  const chartCards = SUMMARY_INDICATORS.map((indicator) => ({
    indicator,
    measurements: buildChartMeasurements(measurements, indicator)
  }))
  const nonEmptyCards = chartCards.filter((card) => card.measurements.length > 0)
  const visibleCards =
    nonEmptyCards.length > 0 ? nonEmptyCards : chartCards.filter((card) => card.indicator !== 'bmi-for-age')

  async function handleSubmitMeasurement(values: {
    date: string
    heightCm?: number
    weightKg?: number
    headCircumferenceCm?: number
  }) {
    clearPendingEditClose()
    setMeasurementFormError(null)

    try {
      if (editingMeasurement) {
        await updateMeasurement({
          childId: child.id,
          originalDate: editingMeasurement.date,
          date: values.date,
          ageMonths: ageInMonths(child.dateOfBirth, values.date),
          heightCm: values.heightCm,
          weightKg: values.weightKg,
          headCircumferenceCm: values.headCircumferenceCm,
          note: editingMeasurement.note
        })
      } else {
        await addMeasurement({
          childId: child.id,
          childBirthDate: child.dateOfBirth,
          date: values.date,
          heightCm: values.heightCm,
          weightKg: values.weightKg,
          headCircumferenceCm: values.headCircumferenceCm
        })
      }
    } catch (error) {
      if (error instanceof MeasurementConflictError) {
        setMeasurementFormError('目标日期已有测量记录，请选其他日期')
        return
      }

      if (error instanceof MeasurementMissingError) {
        setMeasurementFormError('原记录已被删除，请重新打开')
        closeEditTimeoutRef.current = window.setTimeout(() => {
          closeEditTimeoutRef.current = null
          setMeasurementFormError(null)
          setIsFormOpen(false)
          setEditingMeasurement(null)
        }, 900)
        return
      }

      throw error
    }

    await onMeasurementsChanged()
    setMeasurementFormError(null)
    setIsFormOpen(false)
    setEditingMeasurement(null)
  }

  async function handleDeleteMeasurement(date: string) {
    await deleteMeasurement(child.id, date)
    await onMeasurementsChanged()
  }

  function handleEditMeasurement(measurement: MeasurementRecord) {
    clearPendingEditClose()
    setIsFormOpen(false)
    setMeasurementFormError(null)
    setEditingMeasurement(measurement)
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
          onEdit={handleEditMeasurement}
          onDelete={handleDeleteMeasurement}
        />

        <ResetButton onConfirm={handleResetAllData} />

        <button
          className="fab-button"
          type="button"
          aria-label="新增测量记录"
          onClick={() => {
            clearPendingEditClose()
            setMeasurementFormError(null)
            setEditingMeasurement(null)
            setIsFormOpen(true)
          }}
        >
          + 记录
        </button>

        {isFormOpen || editingMeasurement ? (
          <MeasurementForm
            key={editingMeasurement ? `edit:${editingMeasurement.date}` : 'add'}
            child={child}
            mode={editingMeasurement ? 'edit' : 'add'}
            initialValues={
              editingMeasurement
                ? {
                    date: editingMeasurement.date,
                    heightCm: editingMeasurement.heightCm,
                    weightKg: editingMeasurement.weightKg,
                    headCircumferenceCm: editingMeasurement.headCircumferenceCm
                  }
                : undefined
            }
            onCancel={() => {
              clearPendingEditClose()
              setMeasurementFormError(null)
              setIsFormOpen(false)
              setEditingMeasurement(null)
            }}
            errorMessage={measurementFormError}
            onSubmit={handleSubmitMeasurement}
          />
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
