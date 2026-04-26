import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { Sex } from '@groowooth/core'

import { ageInMonths } from './age'

const DB_NAME = 'groowooth'
const DB_VERSION = 2
const ACTIVE_CHILD_META_KEY = 'activeChildId'
const STORAGE_BLOCKED_MESSAGE = '请关闭其他标签页或刷新页面。'

export class MeasurementConflictError extends Error {
  constructor(message = '目标日期已有测量记录') {
    super(message)
    this.name = 'MeasurementConflictError'
  }
}

export class MeasurementMissingError extends Error {
  constructor(message = '原记录不存在（可能已被其他标签页删除）') {
    super(message)
    this.name = 'MeasurementMissingError'
  }
}

export class BackupValidationError extends Error {
  static forField(field: string, value: unknown): BackupValidationError {
    return new BackupValidationError(`备份文件中的 ${field} 不合法（${formatValidationValue(value)}）`)
  }

  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

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

interface MetaRecord {
  key: string
  value: string
}

export interface ImportedChildRecord extends ChildRecord {
  sourceIndex: number
}

export interface ImportedMeasurementRecord extends MeasurementRecord {
  sourceIndex: number
}

export interface ImportedDataSaveResult {
  added: { children: number; measurements: number }
  skipped: { children: number; measurements: number }
  warnings: string[]
}

interface GroowoothDb extends DBSchema {
  children: {
    key: string
    value: ChildRecord
  }
  meta: {
    key: string
    value: MetaRecord
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
let storageHealthMessage: string | null = null

type StorageHealthListener = (message: string | null) => void

const storageHealthListeners = new Set<StorageHealthListener>()

function publishStorageHealth(message: string | null): void {
  storageHealthMessage = message

  for (const listener of storageHealthListeners) {
    listener(message)
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function formatValidationValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (value === undefined) {
    return 'undefined'
  }

  try {
    const serialized = JSON.stringify(value)
    return serialized ?? String(value)
  } catch {
    return String(value)
  }
}

function toChildRecord(child: ImportedChildRecord): ChildRecord {
  return {
    id: child.id,
    name: child.name,
    sex: child.sex,
    dateOfBirth: child.dateOfBirth,
    gestationalWeeks: child.gestationalWeeks,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt
  }
}

function toMeasurementRecord(measurement: ImportedMeasurementRecord): MeasurementRecord {
  return {
    childId: measurement.childId,
    date: measurement.date,
    ageMonths: measurement.ageMonths,
    heightCm: measurement.heightCm,
    weightKg: measurement.weightKg,
    headCircumferenceCm: measurement.headCircumferenceCm,
    note: measurement.note
  }
}

function getDb(): Promise<IDBPDatabase<GroowoothDb>> {
  if (!dbPromise) {
    publishStorageHealth(null)
    dbPromise = openDB<GroowoothDb>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('children')) {
          db.createObjectStore('children', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }

        if (!db.objectStoreNames.contains('measurements')) {
          const measurements = db.createObjectStore('measurements', {
            keyPath: ['childId', 'date']
          })
          measurements.createIndex('childId', 'childId')
        }

        if (oldVersion < 2) {
          const children = sortChildren(await transaction.objectStore('children').getAll())
          const activeChild = children[0]

          if (activeChild) {
            await transaction.objectStore('meta').put({
              key: ACTIVE_CHILD_META_KEY,
              value: activeChild.id
            })
          }
        }
      },
      blocked() {
        publishStorageHealth(STORAGE_BLOCKED_MESSAGE)
      }
    })
      .then((db) => {
        publishStorageHealth(null)
        db.addEventListener('versionchange', () => {
          db.close()
          dbPromise = null
        })

        return db
      })
      .catch((error) => {
        dbPromise = null
        throw error
      })
  }

  return dbPromise
}

export function subscribeStorageHealth(listener: StorageHealthListener): () => void {
  storageHealthListeners.add(listener)
  listener(storageHealthMessage)

  return () => {
    storageHealthListeners.delete(listener)
  }
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
  const db = await getDb()
  const metaRecord = await db.get('meta', ACTIVE_CHILD_META_KEY)

  if (metaRecord) {
    const activeChild = await db.get('children', metaRecord.value)

    if (activeChild) {
      return activeChild
    }
  }

  const children = sortChildren(await db.getAll('children'))
  const fallbackChild = children[0] ?? null

  if (fallbackChild) {
    await db.put('meta', {
      key: ACTIVE_CHILD_META_KEY,
      value: fallbackChild.id
    })
  } else {
    await db.delete('meta', ACTIVE_CHILD_META_KEY)
  }

  return fallbackChild
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

export async function setActiveChild(childId: string): Promise<void> {
  const db = await getDb()
  const child = await db.get('children', childId)

  if (!child) {
    throw new RangeError('Child not found.')
  }

  await db.put('meta', {
    key: ACTIVE_CHILD_META_KEY,
    value: childId
  })
}

export async function deleteChild(childId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['children', 'meta', 'measurements'], 'readwrite')
  const childStore = tx.objectStore('children')
  const metaStore = tx.objectStore('meta')
  const measurementsStore = tx.objectStore('measurements')
  const activeChildMeta = await metaStore.get(ACTIVE_CHILD_META_KEY)
  const measurementKeys = await measurementsStore.index('childId').getAllKeys(childId)

  await childStore.delete(childId)

  await Promise.all(measurementKeys.map((key) => measurementsStore.delete(key)))

  if (activeChildMeta?.value === childId) {
    await metaStore.delete(ACTIVE_CHILD_META_KEY)
  }

  await tx.done
}

export async function listMeasurements(childId: string): Promise<MeasurementRecord[]> {
  const db = await getDb()
  const measurements = await db.getAllFromIndex('measurements', 'childId', childId)

  return sortMeasurements(measurements)
}

export async function listAllMeasurements(): Promise<MeasurementRecord[]> {
  const db = await getDb()
  return sortMeasurements(await db.getAll('measurements'))
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

export async function updateMeasurement(input: {
  childId: string
  originalDate: string
  date: string
  ageMonths: number
  heightCm?: number
  weightKg?: number
  headCircumferenceCm?: number
  note?: string
}): Promise<void> {
  assertMeasurementPayload(input)

  if (input.ageMonths < 0) {
    throw new RangeError('Measurement date cannot be earlier than the child birth date.')
  }

  const { originalDate, ...record } = input
  const db = await getDb()
  const tx = db.transaction(['children', 'measurements'], 'readwrite')
  const childStore = tx.objectStore('children')
  const measurementStore = tx.objectStore('measurements')
  const originalKey: [string, string] = [record.childId, originalDate]
  const originalRecord = await measurementStore.get(originalKey)

  if (!originalRecord) {
    throw new MeasurementMissingError()
  }

  if (originalDate === record.date) {
    await measurementStore.put(record)
  } else {
    const destinationRecord = await measurementStore.get([record.childId, record.date])

    if (destinationRecord) {
      throw new MeasurementConflictError()
    }

    await measurementStore.delete(originalKey)
    await measurementStore.put(record)
  }

  const child = await childStore.get(record.childId)
  if (child) {
    await childStore.put({
      ...child,
      updatedAt: nowIso()
    })
  }

  await tx.done
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

export async function saveImportedData(input: {
  children: ImportedChildRecord[]
  measurements: ImportedMeasurementRecord[]
}): Promise<ImportedDataSaveResult> {
  const db = await getDb()
  const tx = db.transaction(['children', 'meta', 'measurements'], 'readwrite')
  const childStore = tx.objectStore('children')
  const metaStore = tx.objectStore('meta')
  const measurementStore = tx.objectStore('measurements')
  const warnings: string[] = []
  const childIdMap = new Map<string, string>()
  let addedChildren = 0
  let addedMeasurements = 0
  let skippedChildren = 0
  let skippedMeasurements = 0
  let firstAddedChildId: string | null = null

  for (const child of input.children) {
    const childRecord = toChildRecord(child)
    const existingChild = await childStore.get(child.id)

    if (!existingChild) {
      await childStore.put(childRecord)
      childIdMap.set(child.id, child.id)
      addedChildren += 1
      firstAddedChildId ??= child.id
      continue
    }

    if (existingChild.name === child.name) {
      childIdMap.set(child.id, existingChild.id)
      skippedChildren += 1
      continue
    }

    let nextId = crypto.randomUUID()

    while (await childStore.get(nextId)) {
      nextId = crypto.randomUUID()
    }

    await childStore.put({
      ...childRecord,
      id: nextId
    })
    childIdMap.set(child.id, nextId)
    addedChildren += 1
    firstAddedChildId ??= nextId
    warnings.push(`孩子“${child.name}”的 ID 与现有数据冲突，已分配新 ID。`)
  }

  for (const measurement of input.measurements) {
    const resolvedChildId = childIdMap.get(measurement.childId) ?? measurement.childId
    const child = await childStore.get(resolvedChildId)

    if (!child) {
      skippedMeasurements += 1
      warnings.push(`已跳过 ${measurement.date} 的测量记录：找不到对应孩子。`)
      continue
    }

    const recomputedAgeMonths = ageInMonths(child.dateOfBirth, measurement.date)

    if (recomputedAgeMonths < 0) {
      throw BackupValidationError.forField(`measurements[${measurement.sourceIndex}].date`, measurement.date)
    }

    const existingMeasurement = await measurementStore.get([resolvedChildId, measurement.date])

    if (existingMeasurement) {
      skippedMeasurements += 1
      warnings.push(`已跳过 ${measurement.date} 的重复测量记录。`)
      continue
    }

    const measurementRecord = toMeasurementRecord(measurement)

    if (Math.abs(measurement.ageMonths - recomputedAgeMonths) > 0.5) {
      warnings.push(`已使用 ${measurement.date} 的重算月龄，原值已忽略。`)
    }

    await measurementStore.put({
      ...measurementRecord,
      childId: resolvedChildId,
      ageMonths: recomputedAgeMonths
    })
    addedMeasurements += 1
  }

  const activeChildMeta = await metaStore.get(ACTIVE_CHILD_META_KEY)

  if (!activeChildMeta && firstAddedChildId) {
    await metaStore.put({
      key: ACTIVE_CHILD_META_KEY,
      value: firstAddedChildId
    })
  }

  await tx.done

  return {
    added: {
      children: addedChildren,
      measurements: addedMeasurements
    },
    skipped: {
      children: skippedChildren,
      measurements: skippedMeasurements
    },
    warnings
  }
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
