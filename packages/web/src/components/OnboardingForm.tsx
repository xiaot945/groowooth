import { useState, type FormEvent } from 'react'

import type { Sex } from '@groowooth/core'

import { createChild, type ChildRecord } from '../lib/storage'
import { todayIsoDate } from '../lib/format'

type OnboardingMode = 'first-time' | 'add'

interface OnboardingFormProps {
  mode?: OnboardingMode
  onCancel?: () => void
  onCreated: (child: ChildRecord) => void | Promise<void>
}

export function OnboardingForm({
  mode = 'first-time',
  onCancel,
  onCreated
}: OnboardingFormProps) {
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [sex, setSex] = useState<Sex>('female')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isAddMode = mode === 'add'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('请先填写宝宝昵称。')
      return
    }

    if (!dateOfBirth) {
      setError('请先选择出生日期。')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const child = await createChild({
        name: trimmedName,
        dateOfBirth,
        sex
      })
      await onCreated(child)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '保存失败，请稍后重试。'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const titleId = isAddMode ? 'add-child-title' : 'onboarding-title'
  const formContent = (
    <>
      <div>
        <p className="eyebrow">{isAddMode ? '添加孩子' : '第一次使用'}</p>
        <h1 id={titleId}>{isAddMode ? '再建一张宝宝成长卡' : '先建一张宝宝成长卡'}</h1>
        <p className="lead">
          {isAddMode
            ? '会保存在当前浏览器里。添加完成后会自动切换到这位孩子。'
            : '只需一次，之后每次回来都会自动找回这位宝宝的记录。数据只保存在当前浏览器里。'}
        </p>
      </div>

      <form className="stack-form" onSubmit={handleSubmit} aria-busy={isSaving}>
        <div className="field">
          <label htmlFor="child-name">宝宝昵称</label>
          <input
            id="child-name"
            name="name"
            autoComplete="nickname"
            maxLength={24}
            placeholder="例如：小满"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="child-dob">出生日期</label>
          <input
            id="child-dob"
            name="dateOfBirth"
            type="date"
            max={todayIsoDate()}
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
        </div>

        <fieldset className="field fieldset">
          <legend>性别</legend>
          <div className="radio-row">
            <label className="radio-card">
              <input
                type="radio"
                name="sex"
                value="female"
                checked={sex === 'female'}
                onChange={() => setSex('female')}
              />
              <span>女孩</span>
            </label>
            <label className="radio-card">
              <input
                type="radio"
                name="sex"
                value="male"
                checked={sex === 'male'}
                onChange={() => setSex('male')}
              />
              <span>男孩</span>
            </label>
          </div>
        </fieldset>

        {error ? (
          <p className="status-message" role="alert">
            {error}
          </p>
        ) : null}

        {isAddMode ? (
          <div className="action-row">
            <button className="ghost-button" type="button" disabled={isSaving} onClick={onCancel}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? '添加中…' : '添加孩子'}
            </button>
          </div>
        ) : (
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? '保存中…' : '开始记录'}
          </button>
        )}
      </form>
    </>
  )

  if (!isAddMode) {
    return (
      <main className="app-shell">
        <section className="surface-card form-card">{formContent}</section>
      </main>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={isSaving ? undefined : onCancel}>
      <section
        className="modal-card surface-card add-child-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">添加孩子</p>
            <h2 id={titleId}>再建一张宝宝成长卡</h2>
          </div>
          <button className="ghost-button" type="button" disabled={isSaving} onClick={onCancel}>
            取消
          </button>
        </div>

        <p className="lead">会保存在当前浏览器里。添加完成后会自动切换到这位孩子。</p>

        <form className="stack-form" onSubmit={handleSubmit} aria-busy={isSaving}>
          <div className="field">
            <label htmlFor="child-name">宝宝昵称</label>
            <input
              id="child-name"
              name="name"
              autoComplete="nickname"
              maxLength={24}
              placeholder="例如：小满"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="child-dob">出生日期</label>
            <input
              id="child-dob"
              name="dateOfBirth"
              type="date"
              max={todayIsoDate()}
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </div>

          <fieldset className="field fieldset">
            <legend>性别</legend>
            <div className="radio-row">
              <label className="radio-card">
                <input
                  type="radio"
                  name="sex"
                  value="female"
                  checked={sex === 'female'}
                  onChange={() => setSex('female')}
                />
                <span>女孩</span>
              </label>
              <label className="radio-card">
                <input
                  type="radio"
                  name="sex"
                  value="male"
                  checked={sex === 'male'}
                  onChange={() => setSex('male')}
                />
                <span>男孩</span>
              </label>
            </div>
          </fieldset>

          {error ? (
            <p className="status-message" role="alert">
              {error}
            </p>
          ) : null}

          <div className="action-row">
            <button className="ghost-button" type="button" disabled={isSaving} onClick={onCancel}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? '添加中…' : '添加孩子'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
