import { ageInMonths } from '../lib/age'
import { formatAgeLabel, formatDateLabel, todayIsoDate } from '../lib/format'
import type { ChildRecord } from '../lib/storage'

interface ChildHeaderProps {
  child: ChildRecord
}

export function ChildHeader({ child }: ChildHeaderProps) {
  const currentAge = formatAgeLabel(ageInMonths(child.dateOfBirth, todayIsoDate()))

  return (
    <header className="child-header surface-card">
      <div className="child-header__identity">
        <p className="eyebrow">成长曲线</p>
        <h1>{child.name}</h1>
        <p className="child-header__meta">
          {currentAge} · 出生于 {formatDateLabel(child.dateOfBirth)}
        </p>
      </div>
      <span className="banner-pill">假设足月儿</span>
    </header>
  )
}
