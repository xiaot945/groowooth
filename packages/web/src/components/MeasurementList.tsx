import { useState } from 'react'

import type { MeasurementRecord } from '../lib/storage'
import { ageInMonths } from '../lib/age'
import { formatMeasurementAgeLabel } from '../lib/format'

interface MeasurementListProps {
  measurements: MeasurementRecord[]
  childBirthDate: string
  onDelete: (date: string) => Promise<void>
}

function formatMeasurementValues(record: MeasurementRecord): string[] {
  const values: string[] = []

  if (record.heightCm !== undefined) {
    values.push(`身高 ${record.heightCm} cm`)
  }

  if (record.weightKg !== undefined) {
    values.push(`体重 ${record.weightKg} kg`)
  }

  if (record.headCircumferenceCm !== undefined) {
    values.push(`头围 ${record.headCircumferenceCm} cm`)
  }

  return values
}

export function MeasurementList({ measurements, childBirthDate, onDelete }: MeasurementListProps) {
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const orderedMeasurements = [...measurements].sort((left, right) => right.date.localeCompare(left.date))

  async function handleDelete(date: string) {
    setDeletingDate(date)
    setError(null)

    try {
      await onDelete(date)
      setConfirmingDate(null)
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : '删除失败，请稍后再试。'
      setError(message)
    } finally {
      setDeletingDate(null)
    }
  }

  return (
    <section className="surface-card measurement-list" aria-labelledby="measurement-list-title">
      <div className="measurement-list__header">
        <div>
          <p className="eyebrow">测量记录</p>
          <h2 id="measurement-list-title">最近保存的记录</h2>
        </div>
        <p className="helper-text">按日期倒序显示。</p>
      </div>

      {orderedMeasurements.length > 0 ? (
        <div className="measurement-list__scroll">
          <ul className="measurement-list__items">
            {orderedMeasurements.map((record) => {
              const ageLabel = formatMeasurementAgeLabel(ageInMonths(childBirthDate, record.date))
              const isConfirming = confirmingDate === record.date
              const isDeleting = deletingDate === record.date

              return (
                <li key={record.date} className="measurement-list__item">
                  <div className="measurement-list__row">
                    <div className="measurement-list__content">
                      <div className="measurement-list__meta">
                        <span className="measurement-list__date">{record.date}</span>
                        {ageLabel ? <span className="measurement-list__age">{ageLabel}</span> : null}
                      </div>
                      <p className="measurement-list__values">{formatMeasurementValues(record).join(' · ')}</p>
                    </div>

                    <div className="measurement-list__actions">
                      {isConfirming ? (
                        <div className="measurement-list__confirm">
                          <span className="measurement-list__confirm-text">删除这条记录？</span>
                          <button
                            className="ghost-button measurement-list__confirm-button"
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDelete(record.date)}
                          >
                            {isDeleting ? '处理中…' : '确认'}
                          </button>
                          <button
                            className="ghost-button measurement-list__confirm-button"
                            type="button"
                            disabled={isDeleting}
                            onClick={() => {
                              setConfirmingDate(null)
                              setError(null)
                            }}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          className="measurement-list__delete"
                          type="button"
                          aria-label="删除测量记录"
                          onClick={() => {
                            setConfirmingDate(record.date)
                            setError(null)
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="measurement-list__empty muted-text">还没有测量记录，先记一条，下面就会按时间列出来。</p>
      )}

      {error ? (
        <p className="status-message" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
