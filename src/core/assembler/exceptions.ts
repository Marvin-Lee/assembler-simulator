import type { Token } from './tokenizer'
import type { OperandType } from './parser'
import { normalizeType } from '../utils'

export abstract class AssembleError extends Error {
  constructor(msg: string, public position: number, public length: number) {
    super(msg)
  }
}

export class StatementError extends AssembleError {
  constructor(token: Token) {
    super(
      `Expected instruction or label: ${token.getOriginalValue()}`,
      token.position,
      token.length
    )
  }
}

export class InvalidLabelError extends AssembleError {
  constructor(token: Token) {
    const identifier = token.value.endsWith(':') ? token.value.slice(-1) : token.value
    super(
      `Label should start with a charactor or _: ${identifier}`,
      token.position,
      identifier.length
    )
  }
}

export class MissingEndError extends AssembleError {
  constructor() {
    super('Expected END at the end of the source code', 0, 0)
  }
}

export class InvalidNumberError extends AssembleError {
  constructor(token: Token) {
    super(
      `Number should be hexadecimal and less than 256: ${token.value}`,
      token.position,
      token.length
    )
  }
}

export class AddressError extends AssembleError {
  constructor(token: Token) {
    const value = token.value.length > 0 ? token.value : ']'
    const length = token.value.length > 0 ? token.value.length : 1
    super(
      `Expected a number or register: ${value}`,
      token.position + /* opening bracket */ 1,
      length
    )
  }
}

export class OperandTypeError extends AssembleError {
  constructor(token: Token, ...expectedTypes: OperandType[]) {
    const types = expectedTypes
      .map(t => normalizeType(t))
      .reduce((acc, cur, index) => {
        switch (index) {
          case 0:
            return cur
          case expectedTypes.length - 1:
            return `${acc} or ${cur}`
          default:
            return `${acc}, ${cur}`
        }
      }, '')
    super(`Expected ${types}: ${token.getOriginalValue()}`, token.position, token.length)
  }
}

export class MissingCommaError extends AssembleError {
  constructor(token: Token) {
    super(`Expected ,: ${token.getOriginalValue()}`, token.position, token.length)
  }
}

export class DuplicateLabelError extends AssembleError {
  constructor(identifier: string, position: number) {
    super(`Duplicate label: ${identifier}`, position, identifier.length)
  }
}

export class LabelNotExistError extends AssembleError {
  constructor(identifier: string, position: number) {
    super(`Label does not exist: ${identifier}`, position, identifier.length)
  }
}
