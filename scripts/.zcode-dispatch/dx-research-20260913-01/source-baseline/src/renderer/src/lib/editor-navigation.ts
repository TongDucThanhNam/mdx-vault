export function findHeadingLine(source: string, headingPosition: number): number | null {
  const lines = source.split(/\r?\n/)
  let currentHeadingPosition = 0

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s{0,3}#{1,6}\s+\S/.test(lines[index])) {
      if (currentHeadingPosition === headingPosition) {
        return index + 1
      }

      currentHeadingPosition += 1
    }
  }

  return null
}
