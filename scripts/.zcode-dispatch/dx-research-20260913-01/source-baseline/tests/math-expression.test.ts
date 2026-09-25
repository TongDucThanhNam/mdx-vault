import { describe, expect, test } from 'bun:test'

import {
  evaluateMathExpression,
  getMathExpressionVariables,
  parseMathExpression
} from '../src/shared/math-expression'

describe('math expression parser', () => {
  test('respects arithmetic precedence', () => {
    expect(evaluateMathExpression('2 + 3 * 4', {})).toBe(14)
    expect(evaluateMathExpression('(2 + 3) * 4', {})).toBe(20)
  })

  test('treats exponentiation as right-associative', () => {
    expect(evaluateMathExpression('2 ^ 3 ^ 2', {})).toBe(512)
  })

  test('evaluates variables and unary operators', () => {
    const expression = parseMathExpression('-(x - 3) + m * b')

    expect(getMathExpressionVariables(expression)).toEqual(['b', 'm', 'x'])
    expect(
      evaluateMathExpression(expression, {
        x: 10,
        m: 2,
        b: 5
      })
    ).toBe(3)
  })

  test('throws for missing variables', () => {
    expect(() => evaluateMathExpression('x + 1', {})).toThrow('Missing numeric value')
  })

  test('throws for division by zero', () => {
    expect(() => evaluateMathExpression('10 / (x - 2)', { x: 2 })).toThrow('Division by zero')
  })
})
