function parseIsoDate(date: string): Date | null {
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function todayIsoDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatAgeLabel(ageMonths: number): string {
  const wholeMonths = Math.max(0, Math.floor(ageMonths))

  if (wholeMonths < 12) {
    return `${wholeMonths} 月`
  }

  const years = Math.floor(wholeMonths / 12)
  const months = wholeMonths % 12

  if (months === 0) {
    return `${years} 岁`
  }

  return `${years} 岁 ${months} 月`
}

export function formatMeasurementAgeLabel(ageMonths: number): string | null {
  if (!Number.isFinite(ageMonths) || ageMonths < 0) {
    return null
  }

  const wholeMonths = Math.floor(ageMonths)
  const halfMonths = Math.round((ageMonths - wholeMonths) * 2)
  const baseLabel = formatAgeLabel(wholeMonths)

  if (halfMonths <= 0) {
    if (wholeMonths < 12) {
      return `${wholeMonths} 月龄`
    }

    return baseLabel
  }

  return `${baseLabel} 2 周龄`
}

export function formatDateLabel(date: string): string {
  const parsed = parseIsoDate(date)

  if (!parsed) {
    return date
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(parsed)
}
