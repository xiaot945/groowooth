import type { LmsRow } from './types'

const L_EPSILON = 1e-9

function assertPositiveValue(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('value must be a finite number greater than 0')
  }
}

/**
 * Box-Cox z-score from value and LMS row.
 *
 * z = ((value / M)^L - 1) / (L * S)   if L != 0
 * z = ln(value / M) / S               if L == 0
 */
export function valueToZ(value: number, lms: LmsRow): number {
  assertPositiveValue(value)

  const { L, M, S } = lms
  assertPositiveValue(M)
  assertPositiveValue(S)

  if (Math.abs(L) < L_EPSILON) {
    return Math.log(value / M) / S
  }

  return (Math.pow(value / M, L) - 1) / (L * S)
}

/**
 * Inverse Box-Cox transform from z-score to measurement value.
 *
 * value = M * (1 + L * S * z)^(1 / L)   if L != 0
 * value = M * exp(S * z)                if L == 0
 */
export function zToValue(z: number, lms: LmsRow): number {
  if (!Number.isFinite(z)) {
    throw new RangeError('z must be a finite number')
  }

  const { L, M, S } = lms
  assertPositiveValue(M)
  assertPositiveValue(S)

  if (Math.abs(L) < L_EPSILON) {
    return M * Math.exp(S * z)
  }

  const base = 1 + L * S * z
  if (base <= 0) {
    throw new RangeError('z produces a non-positive Box-Cox base')
  }

  return M * Math.pow(base, 1 / L)
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x)
  const p = 0.3275911
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const t = 1 / (1 + p * absX)
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX))

  return sign * y
}

/**
 * Standard normal cumulative distribution function.
 *
 * percentile = 0.5 * (1 + erf(z / sqrt(2)))
 */
export function zToPercentile(z: number): number {
  if (!Number.isFinite(z)) {
    throw new RangeError('z must be a finite number')
  }

  return 0.5 * (1 + erf(z / Math.SQRT2))
}
