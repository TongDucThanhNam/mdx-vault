import type { CellGridCell } from './CellGrid'

export interface CellGridGroup {
  cells: CellGridCell[]
  label?: string
}

export function createCellGroups(
  cells: CellGridCell[],
  groupSize: number,
  groupLabels: string[] = []
): CellGridGroup[] {
  const groups: CellGridGroup[] = []

  for (let start = 0; start < cells.length; start += groupSize) {
    groups.push({
      cells: cells.slice(start, start + groupSize),
      label: groupLabels[groups.length]
    })
  }

  return groups
}
