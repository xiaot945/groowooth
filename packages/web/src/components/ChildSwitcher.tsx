import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import { ageInMonths } from '../lib/age'
import { formatAgeLabel, todayIsoDate } from '../lib/format'
import {
  deleteChild,
  listChildren,
  setActiveChild,
  type ChildRecord
} from '../lib/storage'
import { OnboardingForm } from './OnboardingForm'

interface ChildSwitcherProps {
  activeChildId: string
  onClose: () => void
  onChildChanged: () => Promise<void>
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

function childAgeLabel(child: ChildRecord): string {
  return formatAgeLabel(ageInMonths(child.dateOfBirth, todayIsoDate()))
}

export function ChildSwitcher({ activeChildId, onClose, onChildChanged }: ChildSwitcherProps) {
  const [children, setChildren] = useState<ChildRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [busyChildId, setBusyChildId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    return () => {
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (isAdding) {
      return
    }

    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const target = focusableElements[0] ?? dialog
    target.focus()
  }, [isAdding])

  useEffect(() => {
    let isCancelled = false

    async function loadChildren() {
      setError(null)

      try {
        const nextChildren = await listChildren()

        if (!isCancelled) {
          setChildren(nextChildren)
        }
      } catch (loadError) {
        if (!isCancelled) {
          const message = loadError instanceof Error ? loadError.message : '加载孩子列表失败，请稍后重试。'
          setError(message)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadChildren()

    return () => {
      isCancelled = true
    }
  }, [])

  async function handleSelect(childId: string) {
    if (childId === activeChildId) {
      onClose()
      return
    }

    setBusyChildId(childId)
    setError(null)

    try {
      await setActiveChild(childId)
      await onChildChanged()
      onClose()
    } catch (selectionError) {
      const message = selectionError instanceof Error ? selectionError.message : '切换孩子失败，请稍后重试。'
      setError(message)
    } finally {
      setBusyChildId(null)
    }
  }

  async function handleDelete(child: ChildRecord) {
    if (!window.confirm(`删除 ${child.name} 和所有他/她的记录？`)) {
      return
    }

    setBusyChildId(child.id)
    setError(null)

    try {
      await deleteChild(child.id)
      const nextChildren = await listChildren()
      setChildren(nextChildren)
      await onChildChanged()

      if (child.id === activeChildId || nextChildren.length === 0) {
        onClose()
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : '删除孩子失败，请稍后重试。'
      setError(message)
    } finally {
      setBusyChildId(null)
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    if (focusableElements.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

    if (event.shiftKey) {
      if (!activeElement || activeElement === firstElement || !dialog.contains(activeElement)) {
        event.preventDefault()
        lastElement.focus()
      }

      return
    }

    if (!activeElement || activeElement === lastElement || !dialog.contains(activeElement)) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  if (isAdding) {
    return (
      <OnboardingForm
        mode="add"
        onCancel={() => setIsAdding(false)}
        onCreated={async (child) => {
          await setActiveChild(child.id)
          await onChildChanged()
          onClose()
        }}
      />
    )
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="modal-card surface-card child-switcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby="child-switcher-title"
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="modal-header child-switcher__header">
          <div>
            <p className="eyebrow">孩子档案</p>
            <h2 id="child-switcher-title">选择要查看的孩子</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        {isLoading ? (
          <p className="helper-text">正在读取孩子列表…</p>
        ) : (
          <div className="child-switcher__body">
            <ul className="child-switcher__list">
              {children.map((child) => {
                const isActive = child.id === activeChildId
                const isBusy = busyChildId === child.id

                return (
                  <li key={child.id} className="child-switcher__item">
                    <button
                      className="child-switcher__row"
                      type="button"
                      disabled={busyChildId !== null}
                      onClick={() => void handleSelect(child.id)}
                    >
                      <span className="child-switcher__row-main">
                        <span className="child-switcher__name">{child.name}</span>
                        <span className="child-switcher__meta">{childAgeLabel(child)}</span>
                      </span>
                      <span className="child-switcher__row-side">
                        {isActive ? <span className="child-switcher__current">当前</span> : null}
                        {isActive ? (
                          <span className="child-switcher__check" aria-hidden="true">
                            ✓
                          </span>
                        ) : null}
                      </span>
                    </button>

                    <button
                      className="child-switcher__delete"
                      type="button"
                      aria-label={`删除 ${child.name}`}
                      disabled={busyChildId !== null}
                      onClick={() => void handleDelete(child)}
                    >
                      {isBusy ? '…' : '×'}
                    </button>
                  </li>
                )
              })}
            </ul>

            <button className="ghost-button child-switcher__add" type="button" onClick={() => setIsAdding(true)}>
              + 添加新孩子
            </button>
          </div>
        )}

        {error ? (
          <p className="status-message" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  )
}
