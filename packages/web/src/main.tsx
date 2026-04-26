import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import App from './App'
import './styles/global.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found.')
}

function RootApp() {
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false)
  const [showOfflineReady, setShowOfflineReady] = useState(false)
  const [applyUpdate, setApplyUpdate] = useState<null | (() => void)>(null)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setApplyUpdate(() => () => {
          void updateSW(true)
        })
        setShowRefreshPrompt(true)
      },
      onOfflineReady() {
        setShowOfflineReady(true)
      }
    })

    return () => {
      setApplyUpdate(null)
    }
  }, [])

  useEffect(() => {
    if (!showOfflineReady) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setShowOfflineReady(false)
    }, 2600)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [showOfflineReady])

  return (
    <>
      <App />
      {showRefreshPrompt || showOfflineReady ? (
        <div className="pwa-toast-stack" aria-live="polite" aria-atomic="true">
          {showRefreshPrompt ? (
            <div className="surface-card pwa-toast pwa-toast--action" role="alert">
              <span>新版本已可用</span>
              <button
                type="button"
                className="text-button pwa-toast__action"
                onClick={() => applyUpdate?.()}
              >
                刷新
              </button>
            </div>
          ) : null}
          {showOfflineReady ? (
            <div className="surface-card pwa-toast" role="status">
              已可离线使用
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
)
