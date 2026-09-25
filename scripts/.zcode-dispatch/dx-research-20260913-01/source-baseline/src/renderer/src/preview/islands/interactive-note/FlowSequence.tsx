export interface FlowSequenceNode {
  label: string
  sublabel?: string
  accent?: boolean
}

export interface FlowSequenceProps {
  nodes: FlowSequenceNode[]
  edgeLabels?: string[]
  caption?: string
  direction?: 'row' | 'column'
}

export function FlowSequence({
  nodes,
  edgeLabels = [],
  caption,
  direction = 'row'
}: FlowSequenceProps): React.JSX.Element {
  return (
    <figure className="in-flow-figure">
      <div className={`in-flow-sequence in-flow-sequence-${direction}`}>
        <FlowNode node={nodes[0]} />
        {nodes.slice(1).map((node, index) => (
          <div className="in-flow-segment" key={`${node.label}-${index + 1}`}>
            <span className="in-flow-edge" aria-hidden="true">
              {edgeLabels[index] ? (
                <span className="in-flow-edge-label">{edgeLabels[index]}</span>
              ) : null}
              <span className="in-flow-arrow">{direction === 'column' ? '↓' : '→'}</span>
            </span>
            <FlowNode node={node} />
          </div>
        ))}
      </div>
      {caption ? <figcaption className="in-visual-caption">{caption}</figcaption> : null}
    </figure>
  )
}

function FlowNode({ node }: { node: FlowSequenceNode }): React.JSX.Element {
  return (
    <span className={node.accent ? 'in-flow-node in-flow-node-accent' : 'in-flow-node'}>
      <span className="in-flow-node-label">{node.label}</span>
      {node.sublabel ? <span className="in-flow-node-sublabel">{node.sublabel}</span> : null}
    </span>
  )
}
