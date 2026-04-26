class BaseSchema {
  optional() {
    return new OptionalSchema(this)
  }

  default(value) {
    return new DefaultSchema(this, value)
  }
}

class NumberSchema extends BaseSchema {
  constructor() {
    super()
    this.validators = []
  }

  finite() {
    this.validators.push((value) => Number.isFinite(value) || 'Expected finite number')
    return this
  }

  min(limit) {
    this.validators.push((value) => value >= limit || `Expected number >= ${limit}`)
    return this
  }

  max(limit) {
    this.validators.push((value) => value <= limit || `Expected number <= ${limit}`)
    return this
  }

  nonnegative() {
    return this.min(0)
  }

  positive() {
    this.validators.push((value) => value > 0 || 'Expected positive number')
    return this
  }

  parse(value) {
    if (typeof value !== 'number') {
      throw new Error('Expected number')
    }

    for (const validator of this.validators) {
      const result = validator(value)
      if (result !== true) {
        throw new Error(result)
      }
    }

    return value
  }
}

class EnumSchema extends BaseSchema {
  constructor(values) {
    super()
    this.values = values
  }

  parse(value) {
    if (!this.values.includes(value)) {
      throw new Error(`Expected one of ${this.values.join(', ')}`)
    }

    return value
  }
}

class OptionalSchema extends BaseSchema {
  constructor(inner) {
    super()
    this.inner = inner
  }

  parse(value) {
    return value === undefined ? undefined : this.inner.parse(value)
  }
}

class DefaultSchema extends BaseSchema {
  constructor(inner, defaultValue) {
    super()
    this.inner = inner
    this.defaultValue = defaultValue
  }

  parse(value) {
    return value === undefined ? this.defaultValue : this.inner.parse(value)
  }
}

class ObjectSchema extends BaseSchema {
  constructor(shape) {
    super()
    this.shape = shape
  }

  parse(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Expected object')
    }

    const parsed = {}
    for (const [key, schema] of Object.entries(this.shape)) {
      parsed[key] = schema.parse(value[key])
    }
    return parsed
  }
}

export const z = {
  number() {
    return new NumberSchema()
  },
  enum(values) {
    return new EnumSchema(values)
  },
  object(shape) {
    return new ObjectSchema(shape)
  }
}
