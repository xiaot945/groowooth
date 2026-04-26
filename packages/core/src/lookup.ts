import type { Indicator, Sex, Standard } from './types'

export interface LookupInput {
  standard: Standard
  indicator: Indicator
  sex: Sex
}

export interface LookupPoint {
  x: number
  value: number
}

export function lookup(_input: LookupInput): LookupPoint[] {
  return []
}
