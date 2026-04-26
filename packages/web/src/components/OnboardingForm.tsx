import { useState, type FormEvent } from 'react'

import type { Sex } from '@groowooth/core'

import { createChild, type ChildRecord } from '../lib/storage'
import { todayIsoDate } from '../lib/format'

interface OnboardingFormProps {
  onCreated: (child: ChildRecord) => void
}

export function OnboardingForm({ onCreated }: OnboardingFormProps) {
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [sex, setSex] = useState<Sex>('female')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
      onCreated(child)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '保存失败，请稍后重试。'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="surface-card form-card">
        <p className="eyebrow">第一次使用</p>
        <h1>先建一张宝宝成长卡</h1>
        <p className="lead">
          只需一次，之后每次回来都会自动找回这位宝宝的记录。数据只保存在当前浏览器里。
        </p>

        <form className="stack-form" onSubmit={handleSubmit}>
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

          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? '保存中…' : '开始记录'}
          </button>
        </form>
      </section>
    </main>
  )
}
