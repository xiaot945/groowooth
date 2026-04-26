export type Sex = 'male' | 'female'
export type Standard = 'who-2006' | 'who-2007' | 'nhc-2022'
export type Indicator =
  | 'height-for-age'
  | 'weight-for-age'
  | 'bmi-for-age'
  | 'head-for-age'
  | 'weight-for-length'
  | 'weight-for-height'
export type ZRange = 'within_2_sd' | 'beyond_2_sd' | 'beyond_3_sd'

export interface LmsRow {
  x: number
  L: number
  M: number
  S: number
}

export interface SdRow {
  x: number
  sds: {
    neg3: number
    neg2: number
    neg1: number
    median: number
    pos1: number
    pos2: number
    pos3: number
  }
}

export const DISCLAIMER = '本结果仅为统计参考，不构成医疗建议；如有疑虑请咨询儿科医生。'
