import { describe, expect, test } from 'bun:test'
import { loadCytoscape } from '../src/renderer/src/graph/load-cytoscape'

describe('GOAL-24 Cytoscape dependency gate', () => {
  test('lazy-loads the ESM package and supports the required lifecycle API', async () => {
    const cytoscape = await loadCytoscape()
    const cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'a-b', source: 'a', target: 'b' } }
      ],
      headless: true,
      // Keep style values enabled: the COSE layout reads node padding. With
      // styles disabled Cytoscape returns its cyclic collection sentinel,
      // which Bun 1.4.0 cannot stringify while coercing the value to a number.
      // Production graph surfaces always have styles enabled.
      styleEnabled: true
    })

    let selectionCount = 0
    const onSelect = (): void => {
      selectionCount += 1
    }
    cy.on('select', 'node', onSelect)
    cy.getElementById('a').select()
    cy.off('select', 'node', onSelect)

    const layout = cy.layout({
      name: 'cose',
      animate: false,
      edgeElasticity: 32,
      fit: false,
      gravity: 1,
      idealEdgeLength: 32,
      nodeRepulsion: 2048,
      numIter: 10,
      randomize: false
    })
    layout.run()
    layout.stop()
    cy.resize()

    expect(selectionCount).toBe(1)
    expect(cy.nodes()).toHaveLength(2)
    expect(cy.edges()).toHaveLength(1)

    cy.destroy()
    expect(cy.destroyed()).toBe(true)
  })
})
