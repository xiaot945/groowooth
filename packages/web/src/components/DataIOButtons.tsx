import { useRef, useState, type ChangeEvent } from 'react'

import { downloadBackupAsFile, exportBackup, importBackup } from '../lib/import-export'

interface DataIOButtonsProps {
  onImported: () => Promise<void>
}

type StatusTone = 'success' | 'error'

function buildImportSummary(result: Awaited<ReturnType<typeof importBackup>>): string {
  const skippedDuplicates = result.skipped.children + result.skipped.measurements
  const warningSuffix = result.warnings.length > 0 ? ` 另有 ${result.warnings.length} 条提示。` : ''

  return `导入完成：新增 ${result.added.children} 个孩子，${result.added.measurements} 条测量。跳过 ${skippedDuplicates} 条重复。${warningSuffix}`
}

export function DataIOButtons({ onImported }: DataIOButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<StatusTone>('success')

  async function handleExport() {
    setIsExporting(true)
    setStatusMessage(null)

    try {
      const backup = await exportBackup()
      downloadBackupAsFile(backup)
      setStatusTone('success')
      setStatusMessage(`已导出 ${backup.children.length} 个孩子和 ${backup.measurements.length} 条测量。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请稍后再试。'
      setStatusTone('error')
      setStatusMessage(message)
    } finally {
      setIsExporting(false)
    }
  }

  function handleImportClick() {
    if (isImporting) {
      return
    }

    fileInputRef.current?.click()
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    setIsImporting(true)
    setStatusMessage(null)

    try {
      const text = await file.text()
      let parsed: unknown

      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('文件不是有效的备份')
      }

      const result = await importBackup(parsed)
      await onImported()
      setStatusTone('success')
      setStatusMessage(buildImportSummary(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败，请稍后再试。'
      setStatusTone('error')
      setStatusMessage(message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="data-io">
      <div className="data-io__row">
        <button className="text-button" type="button" disabled={isExporting || isImporting} onClick={() => void handleExport()}>
          {isExporting ? '导出中…' : '导出 JSON'}
        </button>
        <button className="text-button" type="button" disabled={isExporting || isImporting} onClick={handleImportClick}>
          {isImporting ? '导入中…' : '导入 JSON'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          void handleFileSelected(event)
        }}
      />

      {statusMessage ? (
        <p className={statusTone === 'error' ? 'status-message data-io__status' : 'helper-text data-io__status'} role="status">
          {statusMessage}
        </p>
      ) : null}
    </div>
  )
}
