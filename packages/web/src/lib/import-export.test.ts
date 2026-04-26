// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { exportBackup, importBackup } from './import-export'
import * as storage from './storage'

const hasIndexedDb = typeof indexedDB !== 'undefined'

describe('import-export smoke', () => {
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

  it('exports the import-export API', () => {
    expect(exportBackup).toBeTypeOf('function')
    expect(importBackup).toBeTypeOf('function')
  })

  it('round-trips a backup through IndexedDB storage', async () => {
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
      weightKg: 4.8
    })

    const backup = await exportBackup()

    await storage.resetAllData()

    await expect(importBackup(backup)).resolves.toEqual({
      added: {
        children: 1,
        measurements: 1
      },
      skipped: {
        children: 0,
        measurements: 0
      },
      warnings: []
    })

    await expect(storage.listChildren()).resolves.toEqual(backup.children)
    await expect(storage.listMeasurements(child.id)).resolves.toEqual(backup.measurements)
  })

  it('skips duplicate children and remaps colliding IDs with a new child ID', async () => {
    if (!hasIndexedDb) {
      return
    }

    const baseBackup = {
      schema: 'groowooth-backup-v1' as const,
      exportedAt: '2026-04-27T00:00:00.000Z',
      children: [
        {
          id: 'child-1',
          name: '测试宝宝',
          sex: 'female' as const,
          dateOfBirth: '2024-01-01',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-02-01T00:00:00.000Z'
        }
      ],
      measurements: [
        {
          childId: 'child-1',
          date: '2024-02-01',
          ageMonths: 1,
          weightKg: 4.8
        }
      ]
    }

    await importBackup(baseBackup)

    await expect(importBackup(baseBackup)).resolves.toEqual({
      added: {
        children: 0,
        measurements: 0
      },
      skipped: {
        children: 1,
        measurements: 1
      },
      warnings: ['已跳过 2024-02-01 的重复测量记录。']
    })

    const conflictResult = await importBackup({
      ...baseBackup,
      children: [
        {
          ...baseBackup.children[0],
          name: '另一位宝宝',
          sex: 'male'
        }
      ],
      measurements: [
        {
          childId: 'child-1',
          date: '2024-02-15',
          ageMonths: 1,
          heightCm: 55.2
        }
      ]
    })

    expect(conflictResult.added).toEqual({
      children: 1,
      measurements: 1
    })
    expect(conflictResult.skipped).toEqual({
      children: 0,
      measurements: 0
    })
    expect(conflictResult.warnings).toEqual(['孩子“另一位宝宝”的 ID 与现有数据冲突，已分配新 ID。'])

    const children = await storage.listChildren()
    expect(children).toHaveLength(2)

    const remappedChild = children.find((entry) => entry.name === '另一位宝宝')
    expect(remappedChild).toBeDefined()
    expect(remappedChild?.id).not.toBe('child-1')

    await expect(storage.listMeasurements(remappedChild!.id)).resolves.toEqual([
      {
        childId: remappedChild!.id,
        date: '2024-02-15',
        ageMonths: 1,
        heightCm: 55.2
      }
    ])
  })

  it('rejects invalid backup field values with descriptive errors', async () => {
    if (!hasIndexedDb) {
      return
    }

    await expect(
      importBackup({
        schema: 'groowooth-backup-v1',
        exportedAt: '2026-04-27T00:00:00.000Z',
        children: [
          {
            id: 'child-1',
            name: '测试宝宝',
            sex: 'female',
            dateOfBirth: 'not-a-date',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-02-01T00:00:00.000Z'
          }
        ],
        measurements: []
      })
    ).rejects.toThrow('备份文件中的 children[0].dateOfBirth 不合法（"not-a-date"）')

    await expect(
      importBackup({
        schema: 'groowooth-backup-v1',
        exportedAt: '2026-04-27T00:00:00.000Z',
        children: [
          {
            id: 'child-1',
            name: '测试宝宝',
            sex: 'female',
            dateOfBirth: '2024-01-01',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-02-01T00:00:00.000Z'
          }
        ],
        measurements: [
          {
            childId: 'child-1',
            date: '2024-02-01',
            ageMonths: 1,
            weightKg: -5
          }
        ]
      })
    ).rejects.toThrow('备份文件中的 measurements[0].weightKg 不合法（-5）')
  })

  it('recomputes imported ageMonths and keeps the recomputed value', async () => {
    if (!hasIndexedDb) {
      return
    }

    await expect(
      importBackup({
        schema: 'groowooth-backup-v1',
        exportedAt: '2026-04-27T00:00:00.000Z',
        children: [
          {
            id: 'child-1',
            name: '测试宝宝',
            sex: 'female',
            dateOfBirth: '2024-01-01',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-02-01T00:00:00.000Z'
          }
        ],
        measurements: [
          {
            childId: 'child-1',
            date: '2024-03-10',
            ageMonths: 1,
            weightKg: 5.6
          }
        ]
      })
    ).resolves.toEqual({
      added: {
        children: 1,
        measurements: 1
      },
      skipped: {
        children: 0,
        measurements: 0
      },
      warnings: ['已使用 2024-03-10 的重算月龄，原值已忽略。']
    })

    await expect(storage.listMeasurements('child-1')).resolves.toEqual([
      {
        childId: 'child-1',
        date: '2024-03-10',
        ageMonths: 2.5,
        weightKg: 5.6
      }
    ])
  })

  it('rejects measurements dated before the resolved child birth date', async () => {
    if (!hasIndexedDb) {
      return
    }

    await expect(
      importBackup({
        schema: 'groowooth-backup-v1',
        exportedAt: '2026-04-27T00:00:00.000Z',
        children: [
          {
            id: 'child-1',
            name: '测试宝宝',
            sex: 'female',
            dateOfBirth: '2024-03-01',
            createdAt: '2024-03-01T00:00:00.000Z',
            updatedAt: '2024-03-01T00:00:00.000Z'
          }
        ],
        measurements: [
          {
            childId: 'child-1',
            date: '2024-02-01',
            ageMonths: 1,
            weightKg: 4.8
          }
        ]
      })
    ).rejects.toThrow('备份文件中的 measurements[0].date 不合法（"2024-02-01"）')

    await expect(storage.listChildren()).resolves.toEqual([])
    await expect(storage.listAllMeasurements()).resolves.toEqual([])
  })
})
