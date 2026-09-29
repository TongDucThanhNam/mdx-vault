import { build } from 'esbuild'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

import { componentRegistry } from '../../renderer/src/preview/registry'
import type { ComponentRegistryEntry } from '../../renderer/src/preview/registry/types'

export interface BundleOptions {
  usedComponents: string[]
}

export interface BundleResult {
  script: string
  unknownComponents: string[]
}

const registryByName = new Map(componentRegistry.map((entry) => [entry.name, entry]))

export class RegistryBundler {
  async bundle({ usedComponents }: BundleOptions): Promise<BundleResult> {
    const uniqueNames = [...new Set(usedComponents)]
    const entries = uniqueNames.flatMap((name) => {
      const entry = registryByName.get(name)
      return entry ? [entry] : []
    })
    const unknownComponents = uniqueNames.filter((name) => !registryByName.has(name))
    const repoRoot = findRepoRoot(__dirname)
    const workingDir = await mkdtemp(join(repoRoot, '.export-bundle-'))
    const entryPath = join(workingDir, 'entry.ts')

    try {
      await writeFile(entryPath, buildEntryStub(entries), 'utf8')

      const result = await build({
        absWorkingDir: repoRoot,
        entryPoints: [entryPath],
        bundle: true,
        format: 'iife',
        jsx: 'automatic',
        legalComments: 'none',
        logLevel: 'silent',
        platform: 'browser',
        sourcemap: false,
        target: 'es2022',
        minify: true,
        treeShaking: true,
        write: false,
        external: [],
        nodePaths: [join(repoRoot, 'node_modules')],
        tsconfig: join(repoRoot, 'tsconfig.web.json'),
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      })

      const script = result.outputFiles[0]?.text
      if (!script) throw new Error('esbuild did not return an output file for registry bundle')
      return { script, unknownComponents }
    } finally {
      await rm(workingDir, { recursive: true, force: true })
    }
  }
}

function buildEntryStub(entries: ComponentRegistryEntry[]): string {
  const importLines = entries
    .map(
      (entry, index) =>
        `import { ${entry.exportPolicy.entryExport} as RegistryEntry${index} } from '../${entry.exportPolicy.modulePath}'`
    )
    .join('\n')
  const registrations = entries
    .map((entry, index) => `  ${JSON.stringify(entry.name)}: RegistryEntry${index},`)
    .join('\n')

  return `
import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  hostToSandboxMessageSchema,
  sandboxToHostMessageSchema
} from '../src/shared/sandbox'
import {
  sandboxFrameHeight,
  sandboxIframeHeight,
  shouldApplySandboxHeight
} from '../src/renderer/src/preview/sandbox/sandbox-height'

${importLines}

const registry = Object.freeze({
${registrations}
})
let sandboxConfigsByNodeId = new Map()
let sandboxConfigs = []
let pendingHydrationRoots = 0
let sandboxHostStarted = false

function HydrationBoundary({ children }) {
  React.useEffect(() => {
    pendingHydrationRoots = Math.max(0, pendingHydrationRoots - 1)
    maybeStartSandboxHost()
  }, [])
  return children
}

function camelToKebab(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function toReactProperties(properties) {
  const output = {}
  for (const [key, value] of Object.entries(properties || {})) {
    if (key === 'style' && typeof value === 'string') {
      output.style = parseStyleAttribute(value)
    } else if (key === 'className' && Array.isArray(value)) {
      output.className = value.join(' ')
    } else if (key.startsWith('aria') && key.length > 4) {
      output['aria-' + camelToKebab(key.slice(4))] = value
    } else if (key.startsWith('data') && key.length > 4) {
      output['data-' + camelToKebab(key.slice(4))] = value
    } else {
      output[key] = value
    }
  }
  return output
}

function parseStyleAttribute(value) {
  const styles = {}
  for (const declaration of value.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 1) continue
    const property = declaration.slice(0, separator).trim()
    const propertyValue = declaration.slice(separator + 1).trim()
    if (!property || !propertyValue) continue
    const reactProperty = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
    styles[reactProperty] = propertyValue
  }
  return styles
}

function createChildren(nodes) {
  if (!nodes || nodes.length === 0) return undefined
  return nodes.map((node) =>
    React.createElement(React.Fragment, { key: node.id }, createNode(node))
  )
}

function createNode(node) {
  if (node.type === 'text') return node.value
  if (node.type === 'element') {
    return React.createElement(
      node.tagName,
      Object.assign({ key: node.id }, toReactProperties(node.properties)),
      createChildren(node.children)
    )
  }
  if (node.type === 'sandbox') {
    const sandboxConfig = sandboxConfigsByNodeId.get(node.id)
    return React.createElement('div', {
      key: node.id,
      className: 'mdx-vault-sandbox',
      'data-sandbox-node-id': node.id,
      'aria-label': 'Interactive island ' + node.src,
      ...(sandboxConfig && sandboxConfig.available !== true && sandboxConfig.fallbackHtml
        ? { dangerouslySetInnerHTML: { __html: sandboxConfig.fallbackHtml } }
        : {})
    })
  }

  const entry = registry[node.name]
  if (!entry) {
    return React.createElement(
      'div',
      { className: 'mdx-vault-snapshot-placeholder', role: 'alert' },
      'Export bundle is missing trusted component ' + node.name
    )
  }
  const children = createChildren(node.children)
  const props = Object.assign({}, entry.defaultProps || {}, node.props || {})
  if (node.children && node.children.length > 0) props.children = children
  const validation = entry.propsSchema.safeParse(props)
  if (!validation.success) {
    return React.createElement(
      'div',
      { className: 'mdx-vault-snapshot-placeholder', role: 'alert' },
      'Invalid exported props for ' + node.name
    )
  }
  return React.createElement(entry.component, Object.assign({ key: node.id }, validation.data))
}

function readPayload() {
  const element = document.getElementById('mdx-vault-export-data')
  if (!element || !element.textContent) return { roots: [], sandboxes: [] }
  try {
    const parsed = JSON.parse(element.textContent)
    return {
      roots: Array.isArray(parsed.roots) ? parsed.roots : [],
      sandboxes: Array.isArray(parsed.sandboxes) ? parsed.sandboxes : []
    }
  } catch (error) {
    console.error('Could not parse mdx-vault export data', error)
    return { roots: [], sandboxes: [] }
  }
}

function hydrateTrustedRoots(roots) {
  const targets = roots.flatMap((rootNode) => {
    const container = document.querySelector(
      '.mdx-vault-trusted-root[data-export-root-id="' + CSS.escape(rootNode.id) + '"]'
    )
    return container ? [{ rootNode, container }] : []
  })
  pendingHydrationRoots = targets.length

  for (const { rootNode, container } of targets) {
    hydrateRoot(
      container,
      React.createElement(HydrationBoundary, null, createNode(rootNode)),
      {
      identifierPrefix: 'export-' + rootNode.id + '-',
      onRecoverableError(error) {
        console.error('Trusted export hydration recovered from an error', error)
      }
      }
    )
  }
}

function maybeStartSandboxHost() {
  if (sandboxHostStarted || pendingHydrationRoots !== 0) return
  sandboxHostStarted = true
  initializeSandboxHost(sandboxConfigs)
}

function initializeSandboxHost(configs) {
  const frames = []

  function send(frame, message) {
    const target = frame.iframe.contentWindow
    if (!target) return
    target.postMessage(hostToSandboxMessageSchema.parse(message), '*')
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== 'null') return
    const frame = frames.find((candidate) => event.source === candidate.iframe.contentWindow)
    if (!frame) return
    const parsed = sandboxToHostMessageSchema.safeParse(event.data)
    if (!parsed.success || parsed.data.instanceId !== frame.config.instanceId) return
    const message = parsed.data

    if (message.type === 'ready') {
      send(frame, {
        channel: 'mdx-vault',
        instanceId: frame.config.instanceId,
        type: 'init',
        props: frame.config.props
      })
      return
    }

    if (message.type === 'resize') {
      if (shouldApplySandboxHeight(frame.reportedHeight, message.height)) {
        frame.reportedHeight = message.height
        frame.reservation.style.height = sandboxFrameHeight(message.height) + 'px'
        frame.iframe.style.height = sandboxIframeHeight(message.height) + 'px'
      }
      return
    }

    const datasets = frame.config.datasets || {}
    if (Object.prototype.hasOwnProperty.call(datasets, message.path)) {
      send(frame, {
        channel: 'mdx-vault',
        instanceId: frame.config.instanceId,
        type: 'dataResponse',
        requestId: message.requestId,
        ok: true,
        data: datasets[message.path]
      })
    } else {
      send(frame, {
        channel: 'mdx-vault',
        instanceId: frame.config.instanceId,
        type: 'dataResponse',
        requestId: message.requestId,
        ok: false,
        error: 'Dataset is not approved for this island'
      })
    }
  })

  for (const config of configs) {
    const slot = document.querySelector(
      '[data-sandbox-node-id="' + CSS.escape(config.nodeId) + '"]'
    )
    if (!slot || config.available !== true) continue
    const iframe = document.createElement('iframe')
    iframe.className = 'mdx-vault-sandbox-frame'
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.setAttribute('referrerpolicy', 'no-referrer')
    iframe.setAttribute('title', config.title)
    iframe.style.height = sandboxIframeHeight(null) + 'px'
    iframe.srcdoc = config.srcdoc
    const reservation = document.createElement('div')
    reservation.className = 'mdx-vault-sandbox-content'
    reservation.style.height = sandboxFrameHeight(null) + 'px'
    reservation.append(iframe)
    slot.replaceChildren(reservation)
    frames.push({ config, iframe, reservation, reportedHeight: null })
  }
}

function start() {
  const payload = readPayload()
  sandboxConfigs = payload.sandboxes
  sandboxConfigsByNodeId = new Map(
    payload.sandboxes.map((config) => [config.nodeId, config])
  )
  hydrateTrustedRoots(payload.roots)
  maybeStartSandboxHost()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
`
}

function findRepoRoot(start: string): string {
  let current = resolve(start)
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = dirname(current)
    if (parent === current) break
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      if (fs.existsSync(join(parent, 'package.json'))) return parent
    } catch {
      // Continue walking; packaged builds can have a different directory shape.
    }
    current = parent
  }
  return resolve(start)
}

export const __internalTesting = {
  buildEntryStub
}
