import { useEffect, useRef, useState } from 'react'

import type { Standard } from '@groowooth/core'

import { Dashboard } from './components/Dashboard'
import { OnboardingForm } from './components/OnboardingForm'
import {
  getActiveChild,
  getSelectedStandard,
  listMeasurements,
  setSelectedStandard,
  subscribeStorageHealth,
  type ChildRecord,
  type MeasurementRecord
} from './lib/storage'

export default function App() {
  const [child, setChild] = useState<ChildRecord | null>(null)
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [standardError, setStandardError] = useState<string | null>(null)
  const [storageHealth, setStorageHealth] = useState<string | null>(null)
  const [isStandardReady, setIsStandardReady] = useState(false)
  const [selectedStandard, setSelectedStandardState] = useState<Standard>('nhc-2022')
  const requestIdRef = useRef(0)
  const isMountedRef = useRef(true)

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
    isMountedRef.current = true
    void refreshActiveChild()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  async function refreshSelectedStandard() {
    const requestId = ++requestIdRef.current

    try {
      const standard = await getSelectedStandard()

      if (isMountedRef.current && requestIdRef.current === requestId) {
        setSelectedStandardState(standard)
        setStandardError(null)
      }
    } catch (loadError) {
      if (isMountedRef.current && requestIdRef.current === requestId) {
        const message = loadError instanceof Error ? loadError.message : '读取参考标准失败，请刷新后重试。'
        setStandardError(message)
      }
    } finally {
      if (isMountedRef.current) {
        setIsStandardReady(true)
      }
    }
  }

  useEffect(() => {
    void refreshSelectedStandard()
  }, [])

  useEffect(() => subscribeStorageHealth(setStorageHealth), [])

  async function handleSelectedStandardChange(standard: Standard) {
    const requestId = ++requestIdRef.current

    try {
      await setSelectedStandard(standard)

      if (isMountedRef.current && requestIdRef.current === requestId) {
        setSelectedStandardState(standard)
        setStandardError(null)
      }
    } catch (saveError) {
      if (isMountedRef.current && requestIdRef.current === requestId) {
        const message = saveError instanceof Error ? saveError.message : '保存参考标准失败，请稍后重试。'
        setStandardError(message)
      }
    }
  }

  const statusMessage = storageHealth ?? error ?? standardError

  if (isLoading || !isStandardReady) {
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
          selectedStandard={selectedStandard}
          onSelectedStandardChange={handleSelectedStandardChange}
          onMeasurementsChanged={refreshActiveChild}
        />
      ) : (
        <OnboardingForm onCreated={refreshActiveChild} />
      )}
    </>
  )
}
