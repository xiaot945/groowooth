import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'

import { downloadBackupAsFile, exportBackup } from '../lib/import-export'

interface ErrorBoundaryProps {
  children: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
  exportError: string | null
  isExporting: boolean
  retryKey: number
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
    exportError: null,
    isExporting: false,
    retryKey: 0
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return {
      error: toError(error),
      exportError: null
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled application error', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  private handleReset = (): void => {
    this.props.onReset?.()
    this.setState((state) => ({
      error: null,
      errorInfo: null,
      exportError: null,
      isExporting: false,
      retryKey: state.retryKey + 1
    }))
  }

  private handleExport = async (): Promise<void> => {
    this.setState({
      isExporting: true,
      exportError: null
    })

    try {
      const backup = await exportBackup()
      downloadBackupAsFile(backup)
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请稍后再试。'
      this.setState({
        exportError: message,
        isExporting: false
      })
      return
    }

    this.setState({
      isExporting: false
    })
  }

  override render(): ReactNode {
    const { children } = this.props
    const { error, exportError, isExporting, retryKey } = this.state

    if (!error) {
      return <Fragment key={retryKey}>{children}</Fragment>
    }

    return (
      <main className="error-boundary">
        <section className="surface-card error-boundary__card" role="alert" aria-live="assertive">
          <p className="eyebrow">groowooth</p>
          <h1>出了点问题</h1>
          <p className="lead">页面意外崩溃了，但你仍然可以先导出本地数据，避免记录丢失。</p>
          <p className="muted-text error-boundary__detail">{error.message}</p>

          {exportError ? (
            <p className="status-message" role="status">
              {exportError}
            </p>
          ) : null}

          <div className="action-row error-boundary__actions">
            <button className="primary-button" type="button" onClick={this.handleReset}>
              重试
            </button>
            <button className="ghost-button" type="button" disabled={isExporting} onClick={() => void this.handleExport()}>
              {isExporting ? '导出中…' : '导出我的数据'}
            </button>
          </div>
        </section>
      </main>
    )
  }
}
