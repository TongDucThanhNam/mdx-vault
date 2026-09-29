import type cytoscape from 'cytoscape'

import type {
  GraphGroup,
  GraphNode,
  GraphSnapshot,
  GraphViewSettings,
  GraphVisualToken
} from '../../../shared/graph'
import { selectVisibleGraphLabels } from './graph-label-culling'
import { loadCytoscape } from './load-cytoscape'

export interface GraphContextRequest {
  nodeId: string
  x: number
  y: number
}

export interface CytoscapeGraphAdapter {
  setSnapshot: (snapshot: GraphSnapshot, settings: GraphViewSettings, groups?: GraphGroup[]) => void
  setSelection: (nodeId: string | null) => void
  updateSettings: (settings: GraphViewSettings) => void
  fit: () => void
  resetLayout: () => void
  zoomBy: (factor: number) => void
  panBy: (x: number, y: number) => void
  focusNode: (nodeId: string) => void
  destroy: () => void
}

interface CreateCytoscapeGraphAdapterOptions {
  container: HTMLElement
  snapshot: GraphSnapshot
  settings: GraphViewSettings
  groups: GraphGroup[]
  activeRelativePath: string | null
  reducedMotion: boolean
  onSelectNode: (nodeId: string | null) => void
  onOpenNode: (nodeId: string) => void
  onContextNode: (request: GraphContextRequest) => void
}

const GROUP_COLORS_LIGHT: Record<GraphVisualToken, string> = {
  slate: '#475569',
  blue: '#2563eb',
  red: '#be123c',
  green: '#15803d',
  gold: '#a16207',
  violet: '#7e22ce',
  cyan: '#0e7490',
  orange: '#c2410c'
}
const GROUP_COLORS_DARK: Record<GraphVisualToken, string> = {
  slate: '#94a3b8',
  blue: '#60a5fa',
  red: '#fb7185',
  green: '#4ade80',
  gold: '#facc15',
  violet: '#c084fc',
  cyan: '#22d3ee',
  orange: '#fb923c'
}
const GROUP_SHAPES: cytoscape.Css.NodeShape[] = [
  'ellipse',
  'diamond',
  'round-rectangle',
  'triangle',
  'hexagon',
  'vee',
  'pentagon',
  'tag'
]

export async function createCytoscapeGraphAdapter(
  options: CreateCytoscapeGraphAdapterOptions,
  loadLibrary: () => Promise<typeof cytoscape> = loadCytoscape
): Promise<CytoscapeGraphAdapter> {
  const cytoscapeLibrary = await loadLibrary()
  let settings = options.settings
  let snapshot = options.snapshot
  let groups = options.groups
  let selectedNodeId: string | null = null
  let hoveredNodeId: string | null = null
  let layout: cytoscape.Layouts | null = null
  let layoutTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false
  let labelFrame = 0
  const cy = cytoscapeLibrary({
    container: options.container,
    elements: createGraphElements(snapshot, settings, options.activeRelativePath, groups),
    style: createGraphStyles(settings),
    minZoom: 0.15,
    maxZoom: 3,
    wheelSensitivity: 0.18,
    boxSelectionEnabled: false,
    autoungrabify: false,
    userPanningEnabled: true,
    userZoomingEnabled: true
  })

  const runLayout = (): void => {
    if (destroyed) return
    layout?.stop()
    layout = cy.layout(createCoseLayoutOptions(snapshot, settings, options.reducedMotion))
    layout.run()
  }

  const applyHighlight = (): void => {
    if (destroyed) return
    const focusedId = hoveredNodeId ?? selectedNodeId
    const all = cy.elements()
    all.removeClass('muted neighbor selected')
    scheduleLabelVisibility()
    if (!focusedId) return
    const focused = cy.getElementById(focusedId)
    if (focused.empty()) return
    const neighborhood = focused.closedNeighborhood()
    all.not(neighborhood).addClass('muted')
    neighborhood.not(focused).addClass('neighbor')
    if (selectedNodeId) cy.getElementById(selectedNodeId).addClass('selected')
  }

  const updateLabelVisibility = (): void => {
    if (destroyed) return
    const focusedId = hoveredNodeId ?? selectedNodeId
    const neighbors = new Set<string>()
    if (focusedId) {
      cy.getElementById(focusedId)
        .neighborhood('node')
        .forEach((node) => {
          neighbors.add(node.id())
        })
    }
    const degrees = new Map(snapshot.nodes.map((node) => [node.id, node.degree]))
    const visible = selectVisibleGraphLabels(
      cy.nodes().map((node) => ({
        id: node.id(),
        title: String(node.data('label')),
        x: node.renderedPosition().x,
        y: node.renderedPosition().y,
        radius: node.width() / 2,
        degree: degrees.get(node.id()) ?? 0
      })),
      {
        zoom: cy.zoom(),
        fadeThreshold: settings.labelFadeThreshold,
        hoveredId: hoveredNodeId,
        selectedId: selectedNodeId,
        neighborIds: neighbors
      }
    )
    cy.batch(() => {
      cy.nodes().forEach((node) => {
        node.toggleClass('labels-hidden', !visible.has(node.id()))
      })
    })
  }
  const scheduleLabelVisibility = (): void => {
    if (labelFrame || typeof requestAnimationFrame !== 'function') return
    labelFrame = requestAnimationFrame(() => {
      labelFrame = 0
      updateLabelVisibility()
    })
  }

  const applyTheme = (): void => {
    if (destroyed) return
    const nextElements = createGraphElements(snapshot, settings, options.activeRelativePath, groups)
    cy.batch(() => {
      for (const element of nextElements) {
        if (element.group !== 'nodes') continue
        const node = cy.getElementById(String(element.data.id))
        node.data('color', element.data.color)
        node.data('shape', element.data.shape)
      }
    })
    cy.style(createGraphStyles(settings))
  }

  cy.on('mouseover', 'node', (event) => {
    hoveredNodeId = event.target.id()
    applyHighlight()
  })
  cy.on('mouseout', 'node', () => {
    hoveredNodeId = null
    applyHighlight()
  })
  cy.on('tap', 'node', (event) => {
    selectedNodeId = event.target.id()
    options.onSelectNode(selectedNodeId)
    applyHighlight()
  })
  cy.on('tap', (event) => {
    if (event.target === cy) {
      selectedNodeId = null
      options.onSelectNode(null)
      applyHighlight()
    }
  })
  cy.on('dbltap', 'node', (event) => {
    options.onOpenNode(event.target.id())
  })
  cy.on('cxttap', 'node', (event) => {
    const nodeId = event.target.id()
    selectedNodeId = nodeId
    options.onSelectNode(nodeId)
    applyHighlight()
    options.onContextNode({
      nodeId,
      x: event.renderedPosition.x,
      y: event.renderedPosition.y
    })
  })
  cy.on('zoom pan layoutstop position', scheduleLabelVisibility)

  const resizeObserver = new ResizeObserver(() => {
    if (destroyed) return
    cy.resize()
    scheduleLabelVisibility()
  })
  const themeObserver =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          applyTheme()
        })
  resizeObserver.observe(options.container)
  themeObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
  runLayout()
  scheduleLabelVisibility()

  return {
    setSnapshot: (nextSnapshot, nextSettings, nextGroups = groups) => {
      if (destroyed) return
      snapshot = nextSnapshot
      settings = nextSettings
      groups = nextGroups
      layout?.stop()
      cy.batch(() => {
        cy.elements().remove()
        cy.add(createGraphElements(snapshot, settings, options.activeRelativePath, groups))
      })
      cy.style(createGraphStyles(settings))
      runLayout()
      applyHighlight()
      scheduleLabelVisibility()
    },
    setSelection: (nodeId) => {
      if (destroyed) return
      selectedNodeId = nodeId
      applyHighlight()
    },
    updateSettings: (nextSettings) => {
      if (destroyed) return
      const forcesChanged = forceSignature(settings) !== forceSignature(nextSettings)
      settings = nextSettings
      cy.batch(() => {
        for (const node of snapshot.nodes) {
          cy.getElementById(node.id).data('size', calculateNodeSize(node, settings))
        }
        for (const edge of snapshot.edges) {
          cy.getElementById(edge.id).data(
            'width',
            settings.linkThickness * Math.min(3, Math.sqrt(edge.occurrenceCount))
          )
        }
      })
      cy.style(createGraphStyles(settings))
      scheduleLabelVisibility()
      if (forcesChanged) {
        if (layoutTimer) clearTimeout(layoutTimer)
        layoutTimer = setTimeout(runLayout, 180)
      }
    },
    fit: () => {
      if (!destroyed) cy.fit(undefined, 32)
    },
    resetLayout: runLayout,
    zoomBy: (factor) => {
      if (destroyed) return
      const nextZoom = Math.min(3, Math.max(0.15, cy.zoom() * factor))
      cy.zoom({ level: nextZoom, renderedPosition: centerOf(options.container) })
    },
    panBy: (x, y) => {
      if (!destroyed) cy.panBy({ x, y })
    },
    focusNode: (nodeId) => {
      if (destroyed) return
      const node = cy.getElementById(nodeId)
      if (node.empty()) return
      cy.animate({
        center: { eles: node },
        duration: options.reducedMotion ? 0 : 140
      })
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      if (labelFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(labelFrame)
      if (layoutTimer) clearTimeout(layoutTimer)
      layout?.stop()
      resizeObserver.disconnect()
      themeObserver?.disconnect()
      cy.stop(true, true)
      cy.destroy()
      layout = null
    }
  }
}

export function createGraphElements(
  snapshot: GraphSnapshot,
  settings: GraphViewSettings,
  activeRelativePath: string | null,
  groups: GraphGroup[] = []
): cytoscape.ElementDefinition[] {
  const dark = isDarkTheme()
  const palette = dark ? GROUP_COLORS_DARK : GROUP_COLORS_LIGHT
  const groupDefinitions = new Map(
    groups.map((group, index) => [group.id, { group, index }] as const)
  )
  const elements: cytoscape.ElementDefinition[] = snapshot.nodes.map((node) => {
    const primaryGroup = node.groupIds[0] ? (groupDefinitions.get(node.groupIds[0]) ?? null) : null
    return {
      group: 'nodes',
      data: {
        id: node.id,
        label: node.title,
        status: node.status,
        size: calculateNodeSize(node, settings),
        color:
          primaryGroup !== null
            ? palette[primaryGroup.group.visualToken]
            : defaultNodeColor(node, dark),
        shape:
          primaryGroup !== null
            ? GROUP_SHAPES[primaryGroup.index % GROUP_SHAPES.length]
            : node.status === 'ambiguous'
              ? 'diamond'
              : node.status === 'unresolved'
                ? 'round-rectangle'
                : 'ellipse',
        active: node.relativePath === activeRelativePath ? 'yes' : 'no'
      }
    }
  })

  for (const edge of snapshot.edges) {
    elements.push({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        width: settings.linkThickness * Math.min(3, Math.sqrt(edge.occurrenceCount))
      }
    })
  }

  return elements
}

export function createCoseLayoutOptions(
  snapshot: GraphSnapshot,
  settings: GraphViewSettings,
  reducedMotion: boolean
): cytoscape.CoseLayoutOptions {
  return {
    name: 'cose',
    animate: !reducedMotion && snapshot.nodes.length < 350,
    animationDuration: reducedMotion ? 0 : 180,
    randomize: true,
    fit: true,
    padding: 32,
    refresh: snapshot.nodes.length > 1_000 ? 50 : 20,
    componentSpacing: 48,
    nodeRepulsion: settings.repelForce,
    idealEdgeLength: settings.linkDistance,
    edgeElasticity: Math.max(1, 257 - settings.linkForce),
    gravity: settings.centerForce,
    numIter: snapshot.nodes.length > 1_000 ? 80 : 280,
    initialTemp: 100,
    coolingFactor: 0.95,
    minTemp: 1
  }
}

function createGraphStyles(settings: GraphViewSettings): cytoscape.StylesheetJson {
  const dark = isDarkTheme()
  const ink = dark ? '#f8fafc' : '#111827'
  const edge = dark ? '#94a3b8' : '#64748b'
  return [
    {
      selector: 'node',
      style: {
        width: 'data(size)',
        height: 'data(size)',
        shape: (node) => node.data('shape') as cytoscape.Css.NodeShape,
        'background-color': 'data(color)',
        'border-width': 1.5,
        'border-color': ink,
        label: 'data(label)',
        color: ink,
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
        'font-size': 12,
        'text-wrap': 'ellipsis',
        'text-max-width': '120px',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'overlay-opacity': 0
      }
    },
    {
      selector: 'node[active = "yes"]',
      style: {
        'border-width': 4,
        'border-color': '#dc2626'
      }
    },
    {
      selector: 'node[status = "unresolved"]',
      style: {
        'border-style': 'dashed',
        'background-opacity': 0.2
      }
    },
    {
      selector: 'node[status = "ambiguous"]',
      style: {
        'border-style': 'double',
        'border-width': 3
      }
    },
    {
      selector: 'edge',
      style: {
        width: 'data(width)',
        'line-color': edge,
        'target-arrow-color': edge,
        'target-arrow-shape': settings.arrows ? 'triangle' : 'none',
        'curve-style': 'straight',
        opacity: 0.62,
        'overlay-opacity': 0
      }
    },
    {
      selector: '.selected',
      style: {
        'border-width': 4,
        'border-color': '#2563eb',
        'z-index': 20
      }
    },
    {
      selector: '.neighbor',
      style: {
        opacity: 1,
        'z-index': 10
      }
    },
    {
      selector: '.muted',
      style: {
        opacity: 0.12
      }
    },
    {
      selector: '.labels-hidden',
      style: {
        'text-opacity': 0
      }
    }
  ]
}

function calculateNodeSize(node: GraphNode, settings: GraphViewSettings): number {
  return Math.min(64, settings.nodeSize + Math.sqrt(node.degree) * 2.5)
}

function defaultNodeColor(node: GraphNode, dark: boolean): string {
  if (node.status === 'unresolved') return dark ? '#94a3b8' : '#64748b'
  if (node.status === 'ambiguous') return dark ? '#fbbf24' : '#a16207'
  if (node.orphan) return dark ? '#64748b' : '#94a3b8'
  return dark ? '#e2e8f0' : '#f8fafc'
}

function forceSignature(settings: GraphViewSettings): string {
  return [
    settings.centerForce,
    settings.repelForce,
    settings.linkForce,
    settings.linkDistance
  ].join(':')
}

function centerOf(container: HTMLElement): { x: number; y: number } {
  return {
    x: container.clientWidth / 2,
    y: container.clientHeight / 2
  }
}

function isDarkTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}
