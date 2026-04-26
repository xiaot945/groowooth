import { useState, type FormEvent } from 'react'

interface ResetButtonProps {
  onConfirm: () => Promise<void>
}

const CONFIRMATION_TEXT = '重置'

export function ResetButton({ onConfirm }: ResetButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (confirmationInput !== CONFIRMATION_TEXT) {
      setError(`请输入“${CONFIRMATION_TEXT}”以确认。`)
      return
    }

    setIsResetting(true)
    setError(null)

    try {
      await onConfirm()
    } catch (confirmError) {
      const message = confirmError instanceof Error ? confirmError.message : '重置失败，请稍后再试。'
      setError(message)
      setIsResetting(false)
    }
  }

  function closeModal() {
    if (isResetting) {
      return
    }

    setIsOpen(false)
    setConfirmationInput('')
    setError(null)
  }

  return (
    <>
      <div className="reset-button-wrap">
        <button className="text-button" type="button" onClick={() => setIsOpen(true)}>
          重置
        </button>
      </div>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <section
            className="modal-card surface-card reset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">本地数据</p>
                <h2 id="reset-dialog-title">这会删除所有孩子信息和测量记录，确定？</h2>
              </div>
              <button className="ghost-button" type="button" disabled={isResetting} onClick={closeModal}>
                取消
              </button>
            </div>

            <form className="stack-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="reset-confirm-input">输入“重置”后才能继续</label>
                <input
                  id="reset-confirm-input"
                  value={confirmationInput}
                  autoComplete="off"
                  placeholder="重置"
                  disabled={isResetting}
                  onChange={(event) => setConfirmationInput(event.target.value)}
                />
                <p className="helper-text">确认后会清空本机保存的全部数据，并回到首次进入时的引导页。</p>
              </div>

              {error ? (
                <p className="status-message" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="action-row">
                <button className="ghost-button" type="button" disabled={isResetting} onClick={closeModal}>
                  保留数据
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isResetting || confirmationInput !== CONFIRMATION_TEXT}
                >
                  {isResetting ? '重置中…' : '确认重置'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
