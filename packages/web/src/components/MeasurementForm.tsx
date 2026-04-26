import { useState, type FormEvent } from 'react'

import type { ChildRecord } from '../lib/storage'
import { ageInMonths } from '../lib/age'
import { todayIsoDate } from '../lib/format'

interface MeasurementFormValues {
  date: string
  heightCm?: number
  weightKg?: number
  headCircumferenceCm?: number
}

interface MeasurementFormProps {
  child: ChildRecord
  initialValues?: MeasurementFormValues
  mode?: 'add' | 'edit'
  errorMessage?: string | null
  onCancel: () => void
  onSubmit: (values: MeasurementFormValues) => Promise<void>
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  return Number(value)
}

function formatInitialNumber(value?: number): string {
  return value === undefined ? '' : String(value)
}

export function MeasurementForm({
  child,
  initialValues,
  mode = 'add',
  errorMessage = null,
  onCancel,
  onSubmit
}: MeasurementFormProps) {
  const [date, setDate] = useState(initialValues?.date ?? todayIsoDate())
  const [heightCm, setHeightCm] = useState(formatInitialNumber(initialValues?.heightCm))
  const [weightKg, setWeightKg] = useState(formatInitialNumber(initialValues?.weightKg))
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState(
    formatInitialNumber(initialValues?.headCircumferenceCm)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const agePreview = date ? ageInMonths(child.dateOfBirth, date) : null
  const displayedError = error ?? errorMessage
  const title = mode === 'edit' ? '编辑测量' : '记录测量'
  const submitLabel = mode === 'edit' ? '保存修改' : '保存'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedHeight = parseOptionalNumber(heightCm)
    const parsedWeight = parseOptionalNumber(weightKg)
    const parsedHead = parseOptionalNumber(headCircumferenceCm)
    const values = [parsedHeight, parsedWeight, parsedHead].filter((value) => value !== undefined)

    if (!date) {
      setError('请先选择测量日期。')
      return
    }

    if (values.length === 0) {
      setError('请至少填写一项测量值。')
      return
    }

    if (values.some((value) => !Number.isFinite(value) || (value ?? 0) <= 0)) {
      setError('测量值必须是大于 0 的数字。')
      return
    }

    if (agePreview === null || agePreview < 0) {
      setError('测量日期不能早于出生日期。')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSubmit({
        date,
        heightCm: parsedHeight,
        weightKg: parsedWeight,
        headCircumferenceCm: parsedHead
      })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '保存失败，请稍后再试。'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="modal-card surface-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="measurement-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{mode === 'edit' ? '修改记录' : '新增记录'}</p>
            <h2 id="measurement-form-title">{title}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onCancel}>
            取消
          </button>
        </div>

        <form className="stack-form" onSubmit={handleSubmit} aria-busy={isSaving}>
          <div className="field">
            <label htmlFor="measurement-date">测量日期</label>
            <input
              id="measurement-date"
              type="date"
              max={todayIsoDate()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            {agePreview !== null ? (
              <p className="helper-text">本次记录月龄约 {agePreview} 个月。</p>
            ) : (
              <p className="helper-text">测量日期不能早于出生日期。</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="measurement-height">身高（cm）</label>
            <input
              id="measurement-height"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="例如 86.5"
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="measurement-weight">体重（kg）</label>
            <input
              id="measurement-weight"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="例如 12.2"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="measurement-head">头围（cm）</label>
            <input
              id="measurement-head"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="例如 47.0"
              value={headCircumferenceCm}
              onChange={(event) => setHeadCircumferenceCm(event.target.value)}
            />
          </div>

          {displayedError ? (
            <p className="status-message" role="alert">
              {displayedError}
            </p>
          ) : null}

          <div className="action-row">
            <button className="ghost-button" type="button" onClick={onCancel}>
              稍后再记
            </button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? '保存中…' : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
