/** Prefix compiled Tailwind selectors without relying on browser support for CSS @scope. */
export function scopeRegistryStylesheet(source: string): string {
  return rewriteRules(source)
}

function rewriteRules(source: string): string {
  let output = ''
  let cursor = 0
  while (cursor < source.length) {
    if (source.startsWith('/*', cursor)) {
      const end = source.indexOf('*/', cursor + 2)
      if (end < 0) throw new Error('Unclosed export utility CSS comment')
      output += source.slice(cursor, end + 2)
      cursor = end + 2
      continue
    }
    const boundary = findBoundary(source, cursor)
    if (boundary < 0) {
      output += source.slice(cursor)
      break
    }
    if (source[boundary] === ';') {
      output += source.slice(cursor, boundary + 1)
      cursor = boundary + 1
      continue
    }
    const close = findCloseBrace(source, boundary)
    const header = source.slice(cursor, boundary)
    const body = source.slice(boundary + 1, close)
    if (header.trimStart().startsWith('@')) {
      // @property registrations have to remain at top level; their declaration
      // bodies are not selector rules. @layer/@media/@supports stay in order.
      const nested = /^\s*@(layer|media|supports|container)\b/.test(header)
      output += `${header}{${nested ? rewriteRules(body) : body}}`
    } else {
      output += `${prefixSelectorList(header)}{${body}}`
    }
    cursor = close + 1
  }
  return output
}

function findBoundary(source: string, from: number): number {
  let parentheses = 0
  let brackets = 0
  let quote = ''
  for (let i = from; i < source.length; i++) {
    const char = source[i]
    if (!quote && source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2)
      if (end < 0) throw new Error('Unclosed export utility CSS comment')
      i = end + 1
    } else if (char === '\\') {
      i++
    } else if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(') {
      parentheses++
    } else if (char === ')') {
      parentheses--
    } else if (char === '[') {
      brackets++
    } else if (char === ']') {
      brackets--
    } else if (!parentheses && !brackets && (char === '{' || char === ';')) {
      return i
    }
  }
  return -1
}

function findCloseBrace(source: string, open: number): number {
  let depth = 1
  let quote = ''
  for (let i = open + 1; i < source.length; i++) {
    const char = source[i]
    if (!quote && source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2)
      if (end < 0) throw new Error('Unclosed export utility CSS comment')
      i = end + 1
    } else if (char === '\\') {
      i++
    } else if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '{') {
      depth++
    } else if (char === '}' && --depth === 0) {
      return i
    }
  }
  throw new Error('Unclosed export utility CSS rule')
}

function prefixSelectorList(list: string): string {
  let output = ''
  let start = 0
  let parentheses = 0
  let brackets = 0
  let quote = ''
  for (let i = 0; i <= list.length; i++) {
    const char = list[i]
    if (char === '\\') {
      i++
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '(') parentheses++
    else if (char === ')') parentheses--
    else if (char === '[') brackets++
    else if (char === ']') brackets--
    if (i === list.length || (char === ',' && !parentheses && !brackets)) {
      const selector = list.slice(start, i).trim()
      output += `${output ? ',' : ''}:where(.mdx-vault-export) ${selector}`
      start = i + 1
    }
  }
  return output
}
