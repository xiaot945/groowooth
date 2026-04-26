import { useEffect, useState } from 'react'

import { Dashboard } from './components/Dashboard'
import { OnboardingForm } from './components/OnboardingForm'
import {
  getActiveChild,
  listMeasurements,
  subscribeStorageHealth,
  type ChildRecord,
  type MeasurementRecord
} from './lib/storage'

export default function App() {
  const [child, setChild] = useState<ChildRecord | null>(null)
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storageHealth, setStorageHealth] = useState<string | null>(null)

  async function refreshActiveChild() {
    setError(null)

    try {
      const activeChild = await getActiveChild()

      if (!activeChild) {
        setChild(null)
        setMeasurements([])
        return
      }

      const nextMeasurements = await listMeasurements(activeChild.id)
      setChild(activeChild)
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

  useEffect(() => subscribeStorageHealth(setStorageHealth), [])

  const statusMessage = storageHealth ?? error

  if (isLoading) {
    return (
      <>
        {statusMessage ? (
          <div className="global-status" role="alert">
            {statusMessage}
          </div>
        ) : null}

        <main className="app-shell">
          <section className="surface-card empty-card">
            <p className="eyebrow">groowooth</p>
            <h1>正在读取本地成长记录…</h1>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      {statusMessage ? (
        <div className="global-status" role="alert">
          {statusMessage}
        </div>
      ) : null}

      {child ? (
        <Dashboard
          activeChildId={child.id}
          child={child}
          measurements={measurements}
          onMeasurementsChanged={refreshActiveChild}
        />
      ) : (
        <OnboardingForm onCreated={refreshActiveChild} />
      )}
    </>
  )
}
