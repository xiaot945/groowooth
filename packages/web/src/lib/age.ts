const DAYS_PER_MONTH = 30.4375
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseIsoDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00Z`)

  if (Number.isNaN(parsed.valueOf())) {
    throw new RangeError(`Invalid ISO date: ${date}`)
  }

  return parsed
}

export function ageInMonths(birthDate: string, asOfDate: string): number {
  const birth = parseIsoDate(birthDate)
  const asOf = parseIsoDate(asOfDate)
  const diffDays = (asOf.getTime() - birth.getTime()) / MS_PER_DAY
  const rawMonths = diffDays / DAYS_PER_MONTH

  return Math.round(rawMonths * 2) / 2
}
