import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  __resetStandardDataForTest,
  __setStandardLoaderForTest,
  getStandardDataset
} from '../src/standard-data'
import type { StandardDataset } from '../src/types'

function makeDataset(version: string): StandardDataset {
  return {
    source: 'test',
    version,
    url: 'https://example.test/standard',
    indicators: {}
  }
}

describe('standard data loading', () => {
  afterEach(() => {
    __resetStandardDataForTest()
  })

  it('dedupes concurrent loads for the same standard', async () => {
    const dataset = makeDataset('deduped')
    const loader = vi.fn(async () => dataset)

    __setStandardLoaderForTest('nhc-2022', loader)

    const [first, second] = await Promise.all([
      getStandardDataset('nhc-2022'),
      getStandardDataset('nhc-2022')
    ])

    expect(loader).toHaveBeenCalledTimes(1)
    expect(first).toBe(dataset)
    expect(second).toBe(dataset)
    expect(first).toBe(second)
  })

  it('clears rejected pending loads so the next call retries', async () => {
    const dataset = makeDataset('retried')
    const loader = vi
      .fn<() => Promise<StandardDataset>>()
      .mockRejectedValueOnce(new Error('temporary import failure'))
      .mockResolvedValueOnce(dataset)

    __setStandardLoaderForTest('nhc-2022', loader)

    await expect(getStandardDataset('nhc-2022')).rejects.toThrow('temporary import failure')

    const result = await getStandardDataset('nhc-2022')

    expect(loader).toHaveBeenCalledTimes(2)
    expect(result).toBe(dataset)
  })
})
