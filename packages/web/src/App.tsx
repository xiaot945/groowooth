import { useEffect, useState } from 'react'

import { Dashboard } from './components/Dashboard'
import { OnboardingForm } from './components/OnboardingForm'
import {
  getActiveChild,
  listMeasurements,
  type ChildRecord,
  type MeasurementRecord
} from './lib/storage'

export default function App() {
  const [child, setChild] = useState<ChildRecord | null>(null)
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refreshActiveChild() {
    setError(null)

    try {
      const activeChild = await getActiveChild()
      setChild(activeChild)

      if (!activeChild) {
        setMeasurements([])
        return
      }

      const nextMeasurements = await listMeasurements(activeChild.id)
      setMeasurements(nextMeasurements)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '加载失败，请刷新后重试。'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshActiveChild()
  }, [])

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="surface-card empty-card">
          <p className="eyebrow">groowooth</p>
          <h1>正在读取本地成长记录…</h1>
        </section>
      </main>
    )
  }

  return (
    <>
      {error ? (
        <div className="global-status" role="alert">
          {error}
        </div>
      ) : null}

      {child ? (
        <Dashboard child={child} measurements={measurements} onMeasurementsChanged={refreshActiveChild} />
      ) : (
        <OnboardingForm
          onCreated={(createdChild) => {
            setChild(createdChild)
            setMeasurements([])
          }}
        />
      )}
    </>
  )
}
