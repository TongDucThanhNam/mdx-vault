import type { CSSProperties } from 'react'

import { createCellGroups } from './cell-grid-groups'

export type CellGridState = 'default' | 'current' | 'hit' | 'miss' | 'cached' | 'dim'

export interface CellGridCell {
  label?: string
  state?: CellGridState
}

export interface CellGridProps {
  columns: number
  cells: CellGridCell[]
  caption?: string
  groupSize?: number
  groupLabels?: string[]
}

export function CellGrid({
  columns,
  cells,
  caption,
  groupSize,
  groupLabels
}: CellGridProps): React.JSX.Element {
  const gridStyle = { '--in-cell-columns': columns } as CSSProperties

  return (
    <figure className="in-cell-figure">
      {groupSize ? (
        <div
          className="in-cell-groups"
          style={{ '--in-cell-group-columns': columns / groupSize } as CSSProperties}
        >
          {createCellGroups(cells, groupSize, groupLabels).map((group, groupIndex) => (
            <div className="in-cell-group" key={`group-${groupIndex}`}>
              <div className="in-cell-bracket" aria-hidden={group.label ? undefined : true}>
                {group.label ?? '\u00a0'}
              </div>
              <div
                className="in-cell-grid"
                style={{ '--in-cell-columns': groupSize } as CSSProperties}
              >
                {group.cells.map((cell, cellIndex) => (
                  <Cell
                    cell={cell}
                    key={`${cell.label ?? 'cell'}-${groupIndex * groupSize + cellIndex}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="in-cell-grid" style={gridStyle}>
          {cells.map((cell, index) => (
            <Cell cell={cell} key={`${cell.label ?? 'cell'}-${index}`} />
          ))}
        </div>
      )}
      {caption ? <figcaption className="in-visual-caption">{caption}</figcaption> : null}
    </figure>
  )
}

function Cell({ cell }: { cell: CellGridCell }): React.JSX.Element {
  return <span className={`in-cell in-cell-${cell.state ?? 'default'}`}>{cell.label}</span>
}
