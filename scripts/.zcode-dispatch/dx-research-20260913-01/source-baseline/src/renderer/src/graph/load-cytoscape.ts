import type cytoscape from 'cytoscape'

export async function loadCytoscape(): Promise<typeof cytoscape> {
  const module = await import('cytoscape')
  return module.default
}
