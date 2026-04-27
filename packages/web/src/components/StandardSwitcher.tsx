import type { ChangeEvent } from 'react'

import type { Standard } from '@groowooth/core'

interface StandardSwitcherProps {
  value: Standard
  onChange: (standard: Standard) => void
}

const STANDARD_VALUES: Standard[] = ['nhc-2022', 'who-2006', 'who-2007']
const STANDARD_OPTIONS: Array<{ value: Standard; label: string }> = [
  { value: 'nhc-2022', label: '中国卫健委 2022 (0–7岁)' },
  { value: 'who-2006', label: 'WHO 2006 (0–5岁)' },
  { value: 'who-2007', label: 'WHO 2007 (5–19岁)' }
]

function isStandard(value: string): value is Standard {
  return STANDARD_VALUES.includes(value as Standard)
}

export function standardLabel(standard: Standard): string {
  switch (standard) {
    case 'nhc-2022':
      return '卫健委 2022'
    case 'who-2006':
      return 'WHO 2006'
    case 'who-2007':
      return 'WHO 2007'
  }
}

export function StandardSwitcher({ value, onChange }: StandardSwitcherProps) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    if (isStandard(event.target.value)) {
      onChange(event.target.value)
    }
  }

  return (
    <div className="standard-switcher surface-card">
      <label className="standard-switcher__label" htmlFor="standard-select">
        参考标准
      </label>
      <select id="standard-select" className="standard-switcher__select" value={value} onChange={handleChange}>
        {STANDARD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
