import type { Sex } from '@groowooth/core'

import {
  BackupValidationError,
  listAllMeasurements,
  listChildren,
  saveImportedData,
  type ChildRecord,
  type ImportedChildRecord,
  type ImportedMeasurementRecord,
  type MeasurementRecord
} from './storage'

const BACKUP_SCHEMA = 'groowooth-backup-v1'
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
const AGE_MONTHS_RANGE = { min: 0, max: 228 }
const HEIGHT_CM_RANGE = { min: 30, max: 250 }
const WEIGHT_KG_RANGE = { min: 0.5, max: 200 }
const HEAD_CIRCUMFERENCE_CM_RANGE = { min: 25, max: 70 }

export interface BackupV1 {
  schema: 'groowooth-backup-v1'
  exportedAt: string
  children: ChildRecord[]
  measurements: MeasurementRecord[]
}

interface ParsedBackup {
  schema: BackupV1['schema']
  exportedAt: string
  children: ImportedChildRecord[]
  measurements: ImportedMeasurementRecord[]
}

export async function exportBackup(): Promise<BackupV1> {
  const [children, measurements] = await Promise.all([listChildren(), listAllMeasurements()])

  return {
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    children,
    measurements
  }
}

export function downloadBackupAsFile(backup: BackupV1, filename = buildBackupFilename()): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}

export async function importBackup(json: unknown): Promise<{
  added: { children: number; measurements: number }
  skipped: { children: number; measurements: number }
  warnings: string[]
}> {
  const backup = parseBackup(json)
  return saveImportedData({
    children: backup.children,
    measurements: backup.measurements
  })
}

function buildBackupFilename(date = new Date()): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `.groowooth-backup-${year}${month}${day}.json`
}

function parseBackup(json: unknown): ParsedBackup {
  if (!isRecord(json)) {
    throw BackupValidationError.forField('根对象', json)
  }

  const { schema, exportedAt, children, measurements } = json

  if (schema !== BACKUP_SCHEMA) {
    throw BackupValidationError.forField('schema', schema)
  }

  assertValidIsoTimestamp(exportedAt, 'exportedAt')

  if (!Array.isArray(children)) {
    throw BackupValidationError.forField('children', children)
  }

  if (!Array.isArray(measurements)) {
    throw BackupValidationError.forField('measurements', measurements)
  }

  return {
    schema,
    exportedAt,
    children: children.map((child, index) => parseChildRecord(child, index)),
    measurements: measurements.map((measurement, index) => parseMeasurementRecord(measurement, index))
  }
}

function parseChildRecord(value: unknown, index: number): ImportedChildRecord {
  if (!isRecord(value)) {
    throw BackupValidationError.forField(`children[${index}]`, value)
  }

  const id = requireString(value.id, `children[${index}].id`)
  const name = requireString(value.name, `children[${index}].name`)
  const sex = requireSex(value.sex, `children[${index}].sex`)
  const dateOfBirth = requireIsoDate(value.dateOfBirth, `children[${index}].dateOfBirth`)
  const createdAt = requireIsoTimestamp(value.createdAt, `children[${index}].createdAt`)
  const updatedAt = requireIsoTimestamp(value.updatedAt, `children[${index}].updatedAt`)

  return {
    id,
    name,
    sex,
    dateOfBirth,
    gestationalWeeks: requireOptionalFiniteNumber(value.gestationalWeeks, `children[${index}].gestationalWeeks`),
    createdAt,
    updatedAt,
    sourceIndex: index
  }
}

function parseMeasurementRecord(value: unknown, index: number): ImportedMeasurementRecord {
  if (!isRecord(value)) {
    throw BackupValidationError.forField(`measurements[${index}]`, value)
  }

  const hasMeasurementValue =
    value.heightCm !== undefined || value.weightKg !== undefined || value.headCircumferenceCm !== undefined

  if (!hasMeasurementValue) {
    throw BackupValidationError.forField(`measurements[${index}]`, value)
  }

  return {
    childId: requireString(value.childId, `measurements[${index}].childId`),
    date: requireIsoDate(value.date, `measurements[${index}].date`),
    ageMonths: requireNumberInRange(value.ageMonths, `measurements[${index}].ageMonths`, AGE_MONTHS_RANGE),
    heightCm: requireOptionalNumberInRange(value.heightCm, `measurements[${index}].heightCm`, HEIGHT_CM_RANGE),
    weightKg: requireOptionalNumberInRange(value.weightKg, `measurements[${index}].weightKg`, WEIGHT_KG_RANGE),
    headCircumferenceCm: requireOptionalNumberInRange(
      value.headCircumferenceCm,
      `measurements[${index}].headCircumferenceCm`,
      HEAD_CIRCUMFERENCE_CM_RANGE
    ),
    note: requireOptionalString(value.note, `measurements[${index}].note`),
    sourceIndex: index
  }
}

function requireSex(value: unknown, field: string): Sex {
  if (!isSex(value)) {
    throw BackupValidationError.forField(field, value)
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSex(value: unknown): value is Sex {
  return value === 'male' || value === 'female'
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw BackupValidationError.forField(field, value)
  }

  return value
}

function requireOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw BackupValidationError.forField(field, value)
  }

  return value
}

function requireOptionalFiniteNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw BackupValidationError.forField(field, value)
  }

  return value
}

function requireNumberInRange(
  value: unknown,
  field: string,
  range: {
    min: number
    max: number
  }
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) {
    throw BackupValidationError.forField(field, value)
  }

  return value
}

function requireOptionalNumberInRange(
  value: unknown,
  field: string,
  range: {
    min: number
    max: number
  }
): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return requireNumberInRange(value, field, range)
}

function requireIsoDate(value: unknown, field: string): string {
  if (!isValidIsoDate(value)) {
    throw BackupValidationError.forField(field, value)
  }

  return value
}

function requireIsoTimestamp(value: unknown, field: string): string {
  if (!isValidIsoTimestamp(value)) {
    throw BackupValidationError.forField(field, value)
  }

  return value
}

function assertValidIsoTimestamp(value: unknown, field: string): asserts value is string {
  if (!isValidIsoTimestamp(value)) {
    throw BackupValidationError.forField(field, value)
  }
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_RE.test(value)) {
    return false
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.valueOf())) {
    return false
  }

  const [datePart, timePart] = value.split('T')
  const normalizedTime = [parsed.getUTCHours(), parsed.getUTCMinutes(), parsed.getUTCSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')

  return parsed.toISOString().slice(0, 10) === datePart && normalizedTime === timePart.slice(0, 8)
}
