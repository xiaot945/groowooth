import assert from 'node:assert/strict'

const state = globalThis.__miniVitest ??= {
  tests: [],
  suiteStack: []
}

function suiteName(name) {
  return [...state.suiteStack, name].join(' > ')
}

export function describe(name, fn) {
  state.suiteStack.push(name)
  try {
    fn()
  } finally {
    state.suiteStack.pop()
  }
}

export const test = it

export function it(name, fn) {
  state.tests.push({
    name: suiteName(name),
    fn
  })
}

function toThrowMatcher(received, expected, invert) {
  if (typeof received !== 'function') {
    throw new Error('toThrow expects a function')
  }

  let thrown = null
  try {
    received()
  } catch (error) {
    thrown = error
  }

  const matches =
    thrown !== null &&
    (expected === undefined ||
      (typeof expected === 'string' && String(thrown.message).includes(expected)) ||
      (expected instanceof RegExp && expected.test(String(thrown.message))) ||
      (typeof expected === 'function' && thrown instanceof expected))

  if (invert ? matches : !matches) {
    throw new assert.AssertionError({
      message: invert ? 'Expected function not to throw matching error' : 'Expected function to throw matching error'
    })
  }
}

function createMatchers(received, invert = false) {
  const wrap = (passed, message) => {
    if (invert ? passed : !passed) {
      throw new assert.AssertionError({ message })
    }
  }

  return {
    get not() {
      return createMatchers(received, !invert)
    },
    toBe(expected) {
      wrap(Object.is(received, expected), `Expected ${received} to be ${expected}`)
    },
    toEqual(expected) {
      wrap(assert.deepStrictEqual(received, expected) === undefined, 'Expected values to be deeply equal')
    },
    toStrictEqual(expected) {
      wrap(assert.deepStrictEqual(received, expected) === undefined, 'Expected values to be strictly equal')
    },
    toBeCloseTo(expected, digits = 2) {
      const tolerance = 10 ** -digits / 2
      wrap(
        typeof received === 'number' && typeof expected === 'number' && Math.abs(received - expected) <= tolerance,
        `Expected ${received} to be close to ${expected} within ${digits} digits`
      )
    },
    toBeLessThan(expected) {
      wrap(received < expected, `Expected ${received} < ${expected}`)
    },
    toBeLessThanOrEqual(expected) {
      wrap(received <= expected, `Expected ${received} <= ${expected}`)
    },
    toBeGreaterThan(expected) {
      wrap(received > expected, `Expected ${received} > ${expected}`)
    },
    toBeGreaterThanOrEqual(expected) {
      wrap(received >= expected, `Expected ${received} >= ${expected}`)
    },
    toContain(expected) {
      wrap(received.includes(expected), `Expected ${received} to contain ${expected}`)
    },
    toMatch(expected) {
      const matches = expected instanceof RegExp ? expected.test(String(received)) : String(received).includes(String(expected))
      wrap(matches, `Expected ${received} to match ${expected}`)
    },
    toBeDefined() {
      wrap(received !== undefined, 'Expected value to be defined')
    },
    toThrow(expected) {
      toThrowMatcher(received, expected, invert)
    }
  }
}

export function expect(received) {
  return createMatchers(received)
}
