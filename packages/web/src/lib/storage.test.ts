// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import * as storage from './storage'

describe('storage smoke', () => {
  it('exports the storage API', () => {
    expect(storage.getActiveChild).toBeTypeOf('function')
    expect(storage.listChildren).toBeTypeOf('function')
    expect(storage.createChild).toBeTypeOf('function')
    expect(storage.listMeasurements).toBeTypeOf('function')
    expect(storage.addMeasurement).toBeTypeOf('function')
    expect(storage.deleteMeasurement).toBeTypeOf('function')
  })
})
