import { ageInMonths } from '../lib/age'
import { formatAgeLabel, formatDateLabel, todayIsoDate } from '../lib/format'
import type { ChildRecord } from '../lib/storage'

interface ChildHeaderProps {
  child: ChildRecord
  onOpenSwitcher: () => void
}

export function ChildHeader({ child, onOpenSwitcher }: ChildHeaderProps) {
  const currentAge = formatAgeLabel(ageInMonths(child.dateOfBirth, todayIsoDate()))

  return (
    <header className="child-header surface-card">
      <button
        className="child-header__switcher"
        type="button"
        aria-haspopup="dialog"
        aria-label={`切换孩子，当前是 ${child.name}`}
        onClick={onOpenSwitcher}
      >
        <div className="child-header__identity">
          <p className="eyebrow">成长曲线</p>
          <div className="child-header__title-row">
            <h1>{child.name}</h1>
            <span className="child-header__chevron" aria-hidden="true">
              ˅
            </span>
          </div>
          <p className="child-header__meta">
            {currentAge} · 出生于 {formatDateLabel(child.dateOfBirth)}
          </p>
        </div>
      </button>
      <span className="banner-pill">假设足月儿</span>
    </header>
  )
}
