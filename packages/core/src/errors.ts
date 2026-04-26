export class OutOfRangeError extends Error {
  constructor(message = 'Input is outside the supported standard range.') {
    super(message)
    this.name = 'OutOfRangeError'
  }
}

export class OutOfPlausibleRangeError extends Error {
  constructor(message = 'Input is outside the plausible measurement range.') {
    super(message)
    this.name = 'OutOfPlausibleRangeError'
  }
}

export class NotImplementedError extends Error {
  constructor(message = 'This feature is not implemented yet.') {
    super(message)
    this.name = 'NotImplementedError'
  }
}
