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

/**
 * Approximate inverse standard normal CDF.
 *
 * p is expressed on the 0..1 scale.
 * Coefficients adapted from Peter J. Acklam's rational approximation.
 */
export function percentileToZ(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new RangeError('percentile must be a finite number between 0 and 1')
  }

  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239
  ]
  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572
  ]
  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783
  ]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const lower = 0.02425
  const upper = 1 - lower

  if (p < lower) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }

  if (p > upper) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }

  const q = p - 0.5
  const r = q * q

  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}
