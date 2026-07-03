export type ChartPrimitive = string | number | boolean | null
export type ChartDatum = Record<string, ChartPrimitive>

export function parseChartDataSource(content: string, sourcePath: string): ChartDatum[] {
  const normalizedPath = sourcePath.toLowerCase()

  if (normalizedPath.endsWith('.json')) {
    return parseJsonChartData(content)
  }

  if (normalizedPath.endsWith('.csv')) {
    return parseCsvChartData(content)
  }

  throw new Error('DataChart only supports .csv and .json datasets')
}

export function parseJsonChartData(content: string): ChartDatum[] {
  const parsed = JSON.parse(content) as unknown
  return assertChartDataArray(parsed)
}

export function parseCsvChartData(content: string): ChartDatum[] {
  const rows = parseCsvRows(content).filter((row) => row.some((cell) => cell.trim().length > 0))

  if (rows.length < 2) {
    throw new Error('CSV dataset needs a header row and at least one data row')
  }

  const headers = rows[0].map((header) => header.trim())

  if (headers.some((header) => header.length === 0)) {
    throw new Error('CSV header cells cannot be empty')
  }

  return rows.slice(1).map((row) => {
    const datum: ChartDatum = {}

    headers.forEach((header, index) => {
      datum[header] = coerceCsvValue(row[index] ?? '')
    })

    return datum
  })
}

export function assertChartDataArray(value: unknown): ChartDatum[] {
  if (!Array.isArray(value)) {
    throw new Error('Chart data must be an array of objects')
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Chart data row ${index + 1} must be an object`)
    }

    const datum: ChartDatum = {}

    for (const [key, cell] of Object.entries(item)) {
      if (!isChartPrimitive(cell)) {
        throw new Error(`Chart data field "${key}" must be a string, number, boolean, or null`)
      }

      datum[key] = cell
    }

    return datum
  })
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    const nextCharacter = input[index + 1]

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        inQuotes = false
      } else {
        field += character
      }

      continue
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true
      continue
    }

    if (character === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (character === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    if (character !== '\r') {
      field += character
    }
  }

  row.push(field)
  rows.push(row)

  return rows
}

function coerceCsvValue(value: string): ChartPrimitive {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  if (trimmed.toLowerCase() === 'true') {
    return true
  }

  if (trimmed.toLowerCase() === 'false') {
    return false
  }

  const numericValue = Number(trimmed)

  if (Number.isFinite(numericValue)) {
    return numericValue
  }

  return trimmed
}

function isChartPrimitive(value: unknown): value is ChartPrimitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}
