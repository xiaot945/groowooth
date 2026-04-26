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
    expect(storage.setActiveChild).toBeTypeOf('function')
    expect(storage.deleteChild).toBeTypeOf('function')
    expect(storage.listMeasurements).toBeTypeOf('function')
    expect(storage.addMeasurement).toBeTypeOf('function')
    expect(storage.deleteMeasurement).toBeTypeOf('function')
    expect(storage.resetAllData).toBeTypeOf('function')
    expect(storage.subscribeStorageHealth).toBeTypeOf('function')
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

  it('setActiveChild updates getActiveChild', async () => {
    if (!hasIndexedDb) {
      return
    }

    const firstChild = await storage.createChild({
      name: '大宝',
      sex: 'male',
      dateOfBirth: '2022-01-01'
    })
    const secondChild = await storage.createChild({
      name: '二宝',
      sex: 'female',
      dateOfBirth: '2024-01-01'
    })

    await storage.setActiveChild(firstChild.id)
    expect((await storage.getActiveChild())?.id).toBe(firstChild.id)

    await storage.setActiveChild(secondChild.id)
    expect((await storage.getActiveChild())?.id).toBe(secondChild.id)
  })

  it('deleteChild removes child measurements and falls back to another child', async () => {
    if (!hasIndexedDb) {
      return
    }

    const firstChild = await storage.createChild({
      name: '姐姐',
      sex: 'female',
      dateOfBirth: '2021-06-01'
    })
    const secondChild = await storage.createChild({
      name: '弟弟',
      sex: 'male',
      dateOfBirth: '2023-03-01'
    })

    await storage.addMeasurement({
      childId: firstChild.id,
      childBirthDate: firstChild.dateOfBirth,
      date: '2021-07-01',
      weightKg: 4.8
    })
    await storage.setActiveChild(firstChild.id)

    await storage.deleteChild(firstChild.id)

    expect(await storage.listMeasurements(firstChild.id)).toHaveLength(0)
    expect(await storage.listChildren()).toHaveLength(1)
    expect((await storage.getActiveChild())?.id).toBe(secondChild.id)
  })
})
