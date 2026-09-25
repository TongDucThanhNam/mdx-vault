export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatUniqueTimestamp(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

export function buildDailyNoteScaffold(date: string): string {
  return `---\ntitle: ${date}\ndate: ${date}\n---\n\n# ${date}\n\n## Notes\n\n## Links\n\n`
}

export function buildNewNoteScaffold(title: string): string {
  const today = formatLocalDate(new Date())
  return `---\ntitle: ${title}\ncreated: ${today}\n---\n\n# ${title}\n\nStart writing...\n`
}

export function buildTimestampNoteScaffold(timestamp: string): string {
  const today = formatLocalDate(new Date())
  return `---\ntitle: ${timestamp}\ncreated: ${today}\n---\n\n# ${timestamp}\n\n`
}
