export type MathExpressionNode =
  | {
      type: 'number'
      value: number
    }
  | {
      type: 'variable'
      name: string
    }
  | {
      type: 'unary'
      operator: '+' | '-'
      argument: MathExpressionNode
    }
  | {
      type: 'binary'
      operator: '+' | '-' | '*' | '/' | '^'
      left: MathExpressionNode
      right: MathExpressionNode
    }

export interface MathExpression {
  source: string
  ast: MathExpressionNode
}

type Token =
  | {
      type: 'number'
      value: number
      start: number
    }
  | {
      type: 'identifier'
      value: string
      start: number
    }
  | {
      type: 'operator'
      value: '+' | '-' | '*' | '/' | '^'
      start: number
    }
  | {
      type: 'leftParen' | 'rightParen' | 'eof'
      start: number
    }

export class MathExpressionError extends Error {
  readonly index: number

  constructor(message: string, index: number) {
    super(message)
    this.name = 'MathExpressionError'
    this.index = index
  }
}

export function parseMathExpression(source: string): MathExpression {
  const parser = new MathExpressionParser(source)
  return {
    source,
    ast: parser.parse()
  }
}

export function evaluateMathExpression(
  expression: string | MathExpression,
  variables: Record<string, number>
): number {
  const parsed = typeof expression === 'string' ? parseMathExpression(expression) : expression
  return evaluateNode(parsed.ast, variables)
}

export function getMathExpressionVariables(expression: MathExpression): string[] {
  const names = new Set<string>()
  collectVariables(expression.ast, names)
  return Array.from(names).sort((left, right) => left.localeCompare(right))
}

class MathExpressionParser {
  private readonly tokenizer: MathTokenizer
  private current: Token

  constructor(source: string) {
    this.tokenizer = new MathTokenizer(source)
    this.current = this.tokenizer.nextToken()
  }

  parse(): MathExpressionNode {
    const expression = this.parseAdditive()

    if (this.current.type !== 'eof') {
      throw new MathExpressionError('Unexpected token after expression', this.current.start)
    }

    return expression
  }

  private parseAdditive(): MathExpressionNode {
    let node = this.parseMultiplicative()

    while (
      this.current.type === 'operator' &&
      (this.current.value === '+' || this.current.value === '-')
    ) {
      const operator = this.current.value
      this.advance()
      node = {
        type: 'binary',
        operator,
        left: node,
        right: this.parseMultiplicative()
      }
    }

    return node
  }

  private parseMultiplicative(): MathExpressionNode {
    let node = this.parsePower()

    while (
      this.current.type === 'operator' &&
      (this.current.value === '*' || this.current.value === '/')
    ) {
      const operator = this.current.value
      this.advance()
      node = {
        type: 'binary',
        operator,
        left: node,
        right: this.parsePower()
      }
    }

    return node
  }

  private parsePower(): MathExpressionNode {
    const left = this.parseUnary()

    if (this.current.type !== 'operator' || this.current.value !== '^') {
      return left
    }

    this.advance()
    return {
      type: 'binary',
      operator: '^',
      left,
      right: this.parsePower()
    }
  }

  private parseUnary(): MathExpressionNode {
    if (
      this.current.type === 'operator' &&
      (this.current.value === '+' || this.current.value === '-')
    ) {
      const operator = this.current.value
      this.advance()

      return {
        type: 'unary',
        operator,
        argument: this.parseUnary()
      }
    }

    return this.parsePrimary()
  }

  private parsePrimary(): MathExpressionNode {
    if (this.current.type === 'number') {
      const node = {
        type: 'number',
        value: this.current.value
      } satisfies MathExpressionNode
      this.advance()
      return node
    }

    if (this.current.type === 'identifier') {
      const node = {
        type: 'variable',
        name: this.current.value
      } satisfies MathExpressionNode
      this.advance()
      return node
    }

    if (this.current.type === 'leftParen') {
      const start = this.current.start
      this.advance()
      const expression = this.parseAdditive()
      const closingToken = this.current as Token

      if (closingToken.type !== 'rightParen') {
        throw new MathExpressionError('Expected closing parenthesis', start)
      }

      this.advance()
      return expression
    }

    throw new MathExpressionError(
      'Expected a number, variable, or parenthesized expression',
      this.current.start
    )
  }

  private advance(): void {
    this.current = this.tokenizer.nextToken()
  }
}

class MathTokenizer {
  private index = 0

  constructor(private readonly source: string) {}

  nextToken(): Token {
    this.skipWhitespace()

    const start = this.index
    const character = this.source.at(this.index)

    if (character === undefined) {
      return {
        type: 'eof',
        start
      }
    }

    if (isDigit(character) || (character === '.' && isDigit(this.source.at(this.index + 1)))) {
      return this.readNumber()
    }

    if (isIdentifierStart(character)) {
      return this.readIdentifier()
    }

    if (character === '(') {
      this.index += 1
      return {
        type: 'leftParen',
        start
      }
    }

    if (character === ')') {
      this.index += 1
      return {
        type: 'rightParen',
        start
      }
    }

    if (isOperator(character)) {
      this.index += 1
      return {
        type: 'operator',
        value: character,
        start
      }
    }

    throw new MathExpressionError(`Unexpected character "${character}"`, start)
  }

  private readNumber(): Token {
    const start = this.index

    while (isDigit(this.source.at(this.index))) {
      this.index += 1
    }

    if (this.source.at(this.index) === '.') {
      this.index += 1

      while (isDigit(this.source.at(this.index))) {
        this.index += 1
      }
    }

    const exponent = this.source.at(this.index)

    if (exponent === 'e' || exponent === 'E') {
      this.index += 1

      const sign = this.source.at(this.index)

      if (sign === '+' || sign === '-') {
        this.index += 1
      }

      const exponentStart = this.index

      while (isDigit(this.source.at(this.index))) {
        this.index += 1
      }

      if (this.index === exponentStart) {
        throw new MathExpressionError('Expected exponent digits', exponentStart)
      }
    }

    const raw = this.source.slice(start, this.index)
    const value = Number(raw)

    if (!Number.isFinite(value)) {
      throw new MathExpressionError(`Invalid number "${raw}"`, start)
    }

    return {
      type: 'number',
      value,
      start
    }
  }

  private readIdentifier(): Token {
    const start = this.index
    this.index += 1

    while (isIdentifierPart(this.source.at(this.index))) {
      this.index += 1
    }

    return {
      type: 'identifier',
      value: this.source.slice(start, this.index),
      start
    }
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source.at(this.index) ?? '')) {
      this.index += 1
    }
  }
}

function evaluateNode(node: MathExpressionNode, variables: Record<string, number>): number {
  if (node.type === 'number') {
    return node.value
  }

  if (node.type === 'variable') {
    const value = variables[node.name]

    if (!Number.isFinite(value)) {
      throw new MathExpressionError(`Missing numeric value for variable "${node.name}"`, 0)
    }

    return value
  }

  if (node.type === 'unary') {
    const value = evaluateNode(node.argument, variables)
    return node.operator === '-' ? -value : value
  }

  const left = evaluateNode(node.left, variables)
  const right = evaluateNode(node.right, variables)

  if (node.operator === '+') {
    return assertFinite(left + right)
  }

  if (node.operator === '-') {
    return assertFinite(left - right)
  }

  if (node.operator === '*') {
    return assertFinite(left * right)
  }

  if (node.operator === '/') {
    if (right === 0) {
      throw new MathExpressionError('Division by zero', 0)
    }

    return assertFinite(left / right)
  }

  return assertFinite(left ** right)
}

function collectVariables(node: MathExpressionNode, names: Set<string>): void {
  if (node.type === 'variable') {
    names.add(node.name)
    return
  }

  if (node.type === 'unary') {
    collectVariables(node.argument, names)
    return
  }

  if (node.type === 'binary') {
    collectVariables(node.left, names)
    collectVariables(node.right, names)
  }
}

function assertFinite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MathExpressionError('Expression result is not finite', 0)
  }

  return value
}

function isDigit(character: string | undefined): boolean {
  return character !== undefined && character >= '0' && character <= '9'
}

function isIdentifierStart(character: string | undefined): boolean {
  return (
    character !== undefined &&
    ((character >= 'A' && character <= 'Z') ||
      (character >= 'a' && character <= 'z') ||
      character === '_')
  )
}

function isIdentifierPart(character: string | undefined): boolean {
  return isIdentifierStart(character) || isDigit(character)
}

function isOperator(character: string | undefined): character is '+' | '-' | '*' | '/' | '^' {
  return (
    character === '+' ||
    character === '-' ||
    character === '*' ||
    character === '/' ||
    character === '^'
  )
}
