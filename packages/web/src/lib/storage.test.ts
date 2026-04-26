// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import * as storage from './storage'

const hasIndexedDb = typeof indexedDB !== 'undefined'

describe('storage smoke', () => {
  beforeEach(async () => {
    if (hasIndexedDb) {
      await storage.resetAllData()
    }
  })

  afterEach(async () => {
    if (hasIndexedDb) {
      await storage.resetAllData()
    }
  })

  it('exports the storage API', () => {
    expect(storage.getActiveChild).toBeTypeOf('function')
    expect(storage.listChildren).toBeTypeOf('function')
    expect(storage.createChild).toBeTypeOf('function')
    expect(storage.listMeasurements).toBeTypeOf('function')
    expect(storage.addMeasurement).toBeTypeOf('function')
    expect(storage.deleteMeasurement).toBeTypeOf('function')
    expect(storage.resetAllData).toBeTypeOf('function')
  })

  it('resetAllData is callable', async () => {
    if (!hasIndexedDb) {
      return
    }

    await expect(storage.resetAllData()).resolves.toBeUndefined()
  })

  it('deleteMeasurement removes a stored record', async () => {
    if (!hasIndexedDb) {
      return
    }

    const child = await storage.createChild({
      name: '测试宝宝',
      sex: 'female',
      dateOfBirth: '2024-01-01'
    })

    await storage.addMeasurement({
      childId: child.id,
      childBirthDate: child.dateOfBirth,
      date: '2024-02-01',
      heightCm: 56.2
    })

    expect(await storage.listMeasurements(child.id)).toHaveLength(1)

    await storage.deleteMeasurement(child.id, '2024-02-01')

    expect(await storage.listMeasurements(child.id)).toHaveLength(0)
  })
})
