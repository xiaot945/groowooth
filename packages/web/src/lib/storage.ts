import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { Sex } from '@groowooth/core'

import { ageInMonths } from './age'

const DB_NAME = 'groowooth'
const DB_VERSION = 1

export interface ChildRecord {
  id: string
  name: string
  sex: Sex
  dateOfBirth: string
  gestationalWeeks?: number
  createdAt: string
  updatedAt: string
}

export interface MeasurementRecord {
  childId: string
  date: string
  ageMonths: number
  heightCm?: number
  weightKg?: number
  headCircumferenceCm?: number
  note?: string
}

interface GroowoothDb extends DBSchema {
  children: {
    key: string
    value: ChildRecord
  }
  measurements: {
    key: [string, string]
    value: MeasurementRecord
    indexes: {
      childId: string
    }
  }
}

let dbPromise: Promise<IDBPDatabase<GroowoothDb>> | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function getDb(): Promise<IDBPDatabase<GroowoothDb>> {
  if (!dbPromise) {
    dbPromise = openDB<GroowoothDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('children')) {
          db.createObjectStore('children', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('measurements')) {
          const measurements = db.createObjectStore('measurements', {
            keyPath: ['childId', 'date']
          })
          measurements.createIndex('childId', 'childId')
        }
      }
    })
  }

  return dbPromise
}

function sortChildren(children: ChildRecord[]): ChildRecord[] {
  return [...children].sort((left, right) => {
    if (left.updatedAt === right.updatedAt) {
      return right.createdAt.localeCompare(left.createdAt)
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

function sortMeasurements(measurements: MeasurementRecord[]): MeasurementRecord[] {
  return [...measurements].sort((left, right) => left.date.localeCompare(right.date))
}

function assertMeasurementPayload(record: Partial<MeasurementRecord>): void {
  const hasAnyValue =
    record.heightCm !== undefined ||
    record.weightKg !== undefined ||
    record.headCircumferenceCm !== undefined

  if (!hasAnyValue) {
    throw new RangeError('At least one measurement value is required.')
  }
}

export async function getActiveChild(): Promise<ChildRecord | null> {
  const children = await listChildren()
  return children[0] ?? null
}

export async function listChildren(): Promise<ChildRecord[]> {
  const db = await getDb()
  return sortChildren(await db.getAll('children'))
}

export async function createChild(
  input: Omit<ChildRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ChildRecord> {
  const timestamp = nowIso()
  const child: ChildRecord = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp
  }

  const db = await getDb()
  await db.put('children', child)

  return child
}

export async function listMeasurements(childId: string): Promise<MeasurementRecord[]> {
  const db = await getDb()
  const measurements = await db.getAllFromIndex('measurements', 'childId', childId)

  return sortMeasurements(measurements)
}

export async function addMeasurement(
  input: Omit<MeasurementRecord, 'ageMonths'> & { childBirthDate: string }
): Promise<MeasurementRecord> {
  assertMeasurementPayload(input)

  const { childBirthDate, ...recordInput } = input
  const ageMonths = ageInMonths(childBirthDate, input.date)

  if (ageMonths < 0) {
    throw new RangeError('Measurement date cannot be earlier than the child birth date.')
  }

  const record: MeasurementRecord = {
    ...recordInput,
    ageMonths
  }

  const db = await getDb()
  const tx = db.transaction(['children', 'measurements'], 'readwrite')
  const childStore = tx.objectStore('children')
  await tx.objectStore('measurements').put(record)
  const child = await childStore.get(record.childId)
  if (child) {
    await childStore.put({
      ...child,
      updatedAt: nowIso()
    })
  }
  await tx.done

  return record
}

export async function deleteMeasurement(childId: string, date: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['children', 'measurements'], 'readwrite')
  const childStore = tx.objectStore('children')
  await tx.objectStore('measurements').delete([childId, date])
  const child = await childStore.get(childId)
  if (child) {
    await childStore.put({
      ...child,
      updatedAt: nowIso()
    })
  }
  await tx.done
}

export async function resetAllData(): Promise<void> {
  const pendingDb = dbPromise
  dbPromise = null

  if (pendingDb) {
    try {
      const db = await pendingDb
      db.close()
    } catch {
      // Ignore failed opens and continue with best-effort deletion.
    }
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to delete local database.'))
    request.onblocked = () => reject(new Error('请先关闭其他打开 groowooth 的标签页后再试。'))
  })
}
