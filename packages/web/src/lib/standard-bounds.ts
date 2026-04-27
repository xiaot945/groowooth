import { lookup, OutOfRangeError, type Indicator, type Sex, type Standard } from '@groowooth/core'

export interface StandardAgeRange {
  minAgeMonths: number
  maxAgeMonths: number
}

export async function getStandardAgeRange(
  standard: Standard,
  indicator: Indicator,
  sex: Sex
): Promise<StandardAgeRange | null> {
  try {
    const curveData = await lookup({
      standard,
      indicator,
      sex,
      percentiles: [50]
    })
    const medianCurve = curveData.curves.p50
    const firstPoint = medianCurve[0]
    const lastPoint = medianCurve.at(-1)

    if (!firstPoint || !lastPoint) {
      throw new RangeError(`No curve points available for ${standard}/${indicator}/${sex}.`)
    }

    return {
      minAgeMonths: firstPoint.x,
      maxAgeMonths: lastPoint.x
    }
  } catch (error) {
    if (error instanceof OutOfRangeError) {
      return null
    }

    throw error
  }
}
