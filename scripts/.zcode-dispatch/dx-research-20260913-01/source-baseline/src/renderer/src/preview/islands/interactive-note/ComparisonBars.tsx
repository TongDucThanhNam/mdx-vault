export interface ComparisonBarItem {
  label: string
  value: number
  display?: string
  bad?: boolean
}

export interface ComparisonBarsProps {
  items: ComparisonBarItem[]
  caption?: string
}

export function ComparisonBars({ items, caption }: ComparisonBarsProps): React.JSX.Element {
  const maximum = Math.max(1, ...items.map((item) => item.value))

  return (
    <figure className="in-comparison">
      {items.map((item, index) => (
        <div className="in-comparison-row" key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <span className="in-comparison-track" aria-hidden="true">
            <span
              className={item.bad ? 'in-comparison-bar in-comparison-bar-bad' : 'in-comparison-bar'}
              style={{ display: 'block', width: `${(item.value / maximum) * 100}%` }}
            />
          </span>
          <span>{item.display ?? item.value}</span>
        </div>
      ))}
      {caption ? <figcaption className="in-comparison-caption">{caption}</figcaption> : null}
    </figure>
  )
}
