import { createHash, randomUUID } from 'crypto'
import { build, type Plugin } from 'esbuild'
import fg from 'fast-glob'
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'fs/promises'
import { dirname, extname, isAbsolute, posix as pathPosix, relative, resolve } from 'path'
import { z } from 'zod'

import {
  type SandboxDescriptor,
  type SandboxKind,
  type SandboxManifest,
  type SandboxPermissionDecision,
  sandboxManifestSchema
} from '../../shared/sandbox'
import { safeJoin } from './safe-path'
import type { VaultService } from './vault-service'

const permissionStoreRelativePath = '.app/sandbox-permissions.json'
const componentCacheRelativeDir = '.app/component-cache'
const sandboxDraftsRelativeDir = '.app/sandbox-drafts'
const dependencyAllowlist = new Set(['react', 'react-dom'])

export type SandboxDraftCompileResult =
  | { ok: true; contentHash: string; script: string }
  | { ok: false; errors: string[] }

export interface SandboxSourceDocument {
  kind: SandboxKind
  src: string
  resolvedPath: string
  contentHash: string
  instanceId: string
  srcDoc: string
}
const sandboxCsp = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  "connect-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

const permissionStoreSchema = z
  .object({
    version: z.literal(1),
    decisions: z.record(
      z.string(),
      z
        .object({
          kind: z.enum(['html', 'interactive']),
          resolvedPath: z.string(),
          contentHash: z.string(),
          decision: z.enum(['allow', 'deny']),
          decidedAt: z.string()
        })
        .strict()
    )
  })
  .strict()

type PermissionStore = z.infer<typeof permissionStoreSchema>

export class SandboxService {
  constructor(private readonly vault: VaultService) {}

  async describeHtml(src: string, notePath: string | null): Promise<SandboxDescriptor> {
    const target = await this.resolveHtmlTarget(src, notePath)
    const manifest = await this.readManifest(target.rootRelativePath)

    if (manifest.data.runtime !== 'html') {
      throw new Error('SandboxedHTML requires manifest runtime "html"')
    }

    const html = await readFile(target.htmlPath, 'utf8')
    const contentHash = hashParts(['html', target.htmlRelativePath, html, manifest.raw])

    return this.createDescriptor({
      kind: 'html',
      src,
      resolvedPath: target.htmlRelativePath,
      contentHash,
      manifest: manifest.data
    })
  }

  async loadHtml(
    src: string,
    notePath: string | null,
    contentHash: string,
    instanceId: string
  ): Promise<SandboxSourceDocument> {
    const descriptor = await this.describeHtml(src, notePath)
    this.assertAllowedDescriptor(descriptor, contentHash)

    const target = await this.resolveHtmlTarget(src, notePath)
    const html = await readFile(target.htmlPath, 'utf8')

    return {
      kind: 'html',
      src,
      resolvedPath: descriptor.resolvedPath,
      contentHash: descriptor.contentHash,
      instanceId,
      srcDoc: createSandboxHtmlDocument({
        title: descriptor.manifest.name,
        instanceId,
        bodyHtml: html,
        runtimeScript: ''
      })
    }
  }

  async describeInteractive(src: string, notePath: string | null): Promise<SandboxDescriptor> {
    const target = await this.resolveInteractiveTarget(src, notePath)
    const manifest = await this.readManifest(target.rootRelativePath)

    if (manifest.data.runtime !== 'react') {
      throw new Error('Interactive requires manifest runtime "react"')
    }

    const contentHash = await this.hashInteractive(target.rootPath, manifest.raw)

    return this.createDescriptor({
      kind: 'interactive',
      src,
      resolvedPath: target.rootRelativePath,
      contentHash,
      manifest: manifest.data
    })
  }

  /** Compile (and lightly lint) an AI-generated component **without** writing
   *  it to the vault and without consulting the permission store. The draft is
   *  staged under `.app/sandbox-drafts/<draftId>/`, esbuild + dependency guard
   *  run against it, the resulting script (or errors) are returned, and the
   *  staged folder is cleaned up before this method resolves.
   *
   *  The real `interactives/<name>/` folder is created only after the user
   *  approves the patch in the diff review and the renderer calls
   *  `vault:write-file` for each file the patch proposes. This method is
   *  therefore read-only with respect to user content. */
  async compileDraft(
    componentSource: string,
    manifestDraft: SandboxManifest
  ): Promise<SandboxDraftCompileResult> {
    const manifestValidation = sandboxManifestSchema.safeParse(manifestDraft)

    if (!manifestValidation.success) {
      return {
        ok: false,
        errors: manifestValidation.error.issues.map(
          (issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`
        )
      }
    }

    const draftId = randomUUID()
    const draftRoot = safeJoin(this.vault.rootPath, `${sandboxDraftsRelativeDir}/${draftId}`)
    const componentPath = `${draftRoot}/component.tsx`
    const manifestPath = `${draftRoot}/manifest.json`

    try {
      await mkdir(draftRoot, { recursive: true })
      await writeFile(componentPath, componentSource, 'utf8')
      await writeFile(manifestPath, `${JSON.stringify(manifestValidation.data, null, 2)}\n`, 'utf8')

      const script = await this.buildInteractiveBundle({
        rootPath: draftRoot,
        manifest: manifestValidation.data
      })

      const contentHash = hashParts([
        'interactive-draft',
        manifestValidation.data.name,
        componentSource,
        JSON.stringify(manifestValidation.data)
      ])

      return { ok: true, contentHash, script }
    } catch (error) {
      return { ok: false, errors: [formatBuildError(error)] }
    } finally {
      await rm(draftRoot, { recursive: true, force: true })
    }
  }

  async loadInteractive(
    src: string,
    notePath: string | null,
    contentHash: string,
    instanceId: string,
    props: unknown
  ): Promise<SandboxSourceDocument> {
    const descriptor = await this.describeInteractive(src, notePath)
    this.assertAllowedDescriptor(descriptor, contentHash)
    validateProps(descriptor.manifest, props)

    const target = await this.resolveInteractiveTarget(src, notePath)
    const script = await this.compileInteractive(target.rootPath, descriptor.manifest, contentHash)

    return {
      kind: 'interactive',
      src,
      resolvedPath: descriptor.resolvedPath,
      contentHash: descriptor.contentHash,
      instanceId,
      srcDoc: createSandboxHtmlDocument({
        title: descriptor.manifest.name,
        instanceId,
        bodyHtml: '<div id="root"></div>',
        runtimeScript: script
      })
    }
  }

  async setPermission({
    kind,
    src,
    notePath,
    contentHash,
    decision
  }: {
    kind: SandboxKind
    src: string
    notePath: string | null
    contentHash: string
    decision: SandboxPermissionDecision
  }): Promise<SandboxDescriptor> {
    const descriptor =
      kind === 'html'
        ? await this.describeHtml(src, notePath)
        : await this.describeInteractive(src, notePath)

    if (descriptor.contentHash !== contentHash) {
      throw new Error('Sandbox content changed before permission was saved')
    }

    const store = await this.readPermissionStore()
    store.decisions[permissionKey(kind, descriptor.resolvedPath, contentHash)] = {
      kind,
      resolvedPath: descriptor.resolvedPath,
      contentHash,
      decision,
      decidedAt: new Date().toISOString()
    }
    await this.writePermissionStore(store)

    return {
      ...descriptor,
      permissionStatus: decision === 'allow' ? 'allowed' : 'denied'
    }
  }

  async requestData({
    kind,
    src,
    notePath,
    contentHash,
    path
  }: {
    kind: SandboxKind
    src: string
    notePath: string | null
    contentHash: string
    path: string
  }): Promise<string> {
    const descriptor =
      kind === 'html'
        ? await this.describeHtml(src, notePath)
        : await this.describeInteractive(src, notePath)

    this.assertAllowedDescriptor(descriptor, contentHash)

    if (!descriptor.manifest.permissions.filesystem) {
      throw new Error('Manifest does not allow dataset reads')
    }

    const requestedPath = normalizeVaultReference(path, null)
    const allowedPaths = descriptor.manifest.permissions.dataPaths.map((entry) =>
      normalizeVaultReference(entry, null)
    )

    if (!allowedPaths.includes(requestedPath)) {
      throw new Error(`Dataset path is not listed in manifest permissions: ${requestedPath}`)
    }

    await assertPathInsideVault(this.vault.rootPath, safeJoin(this.vault.rootPath, requestedPath))
    return this.vault.readAssetFile(requestedPath)
  }

  private async createDescriptor({
    kind,
    src,
    resolvedPath,
    contentHash,
    manifest
  }: {
    kind: SandboxKind
    src: string
    resolvedPath: string
    contentHash: string
    manifest: SandboxManifest
  }): Promise<SandboxDescriptor> {
    const store = await this.readPermissionStore()
    const decision = store.decisions[permissionKey(kind, resolvedPath, contentHash)]?.decision

    return {
      kind,
      src,
      resolvedPath,
      contentHash,
      manifest,
      permissionStatus: decision === 'allow' ? 'allowed' : decision === 'deny' ? 'denied' : 'prompt'
    }
  }

  private assertAllowedDescriptor(descriptor: SandboxDescriptor, expectedHash: string): void {
    if (descriptor.contentHash !== expectedHash) {
      throw new Error('Sandbox content changed; review permissions again')
    }

    if (descriptor.permissionStatus !== 'allowed') {
      throw new Error('Sandbox permission has not been granted')
    }
  }

  private async resolveHtmlTarget(
    src: string,
    notePath: string | null
  ): Promise<{
    htmlRelativePath: string
    htmlPath: string
    rootRelativePath: string
  }> {
    const htmlRelativePath = normalizeVaultReference(src, notePath)

    if (!isInteractiveVaultPath(htmlRelativePath)) {
      throw new Error('SandboxedHTML files must live under interactives/')
    }

    if (extname(htmlRelativePath).toLowerCase() !== '.html') {
      throw new Error('SandboxedHTML src must point to an .html file')
    }

    const htmlPath = safeJoin(this.vault.rootPath, htmlRelativePath)
    await assertFile(htmlPath, 'SandboxedHTML file not found')
    await assertPathInsideVault(this.vault.rootPath, htmlPath)

    return {
      htmlRelativePath,
      htmlPath,
      rootRelativePath: pathPosix.dirname(htmlRelativePath)
    }
  }

  private async resolveInteractiveTarget(
    src: string,
    notePath: string | null
  ): Promise<{
    rootRelativePath: string
    rootPath: string
    componentPath: string
  }> {
    const rootRelativePath = trimTrailingSlash(normalizeVaultReference(src, notePath))

    if (!isInteractiveVaultPath(rootRelativePath)) {
      throw new Error('Interactive components must live under interactives/')
    }

    if (extname(rootRelativePath)) {
      throw new Error('Interactive src must point to a component folder')
    }

    const rootPath = safeJoin(this.vault.rootPath, rootRelativePath)
    const componentPath = safeJoin(this.vault.rootPath, `${rootRelativePath}/component.tsx`)

    await assertDirectory(rootPath, 'Interactive folder not found')
    await assertFile(componentPath, 'component.tsx not found')
    await assertPathInsideVault(this.vault.rootPath, rootPath)
    await assertPathInsideVault(this.vault.rootPath, componentPath)
    await assertNoSymbolicLinks(rootPath)

    return {
      rootRelativePath,
      rootPath,
      componentPath
    }
  }

  private async readManifest(
    rootRelativePath: string
  ): Promise<{ data: SandboxManifest; raw: string }> {
    const manifestPath = safeJoin(this.vault.rootPath, `${rootRelativePath}/manifest.json`)
    await assertFile(manifestPath, 'manifest.json is required for sandbox content')
    await assertPathInsideVault(this.vault.rootPath, manifestPath)
    const raw = await readFile(manifestPath, 'utf8')

    let parsed: unknown

    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('manifest.json is not valid JSON')
    }

    const result = sandboxManifestSchema.safeParse(parsed)

    if (!result.success) {
      throw new Error(
        `manifest.json failed schema validation: ${result.error.issues
          .map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
          .join('; ')}`
      )
    }

    return {
      data: result.data,
      raw
    }
  }

  private async hashInteractive(rootPath: string, manifestRaw: string): Promise<string> {
    const sourcePaths = await fg(['**/*.{ts,tsx,js,jsx,json,css}'], {
      cwd: rootPath,
      dot: false,
      ignore: ['node_modules/**'],
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false
    })

    const hash = createHash('sha256')
    hash.update('interactive\0')
    hash.update(manifestRaw)

    for (const sourcePath of sourcePaths.sort()) {
      if (sourcePath === 'manifest.json') {
        continue
      }

      hash.update('\0')
      hash.update(sourcePath)
      hash.update('\0')
      hash.update(await readFile(resolve(rootPath, sourcePath), 'utf8'))
    }

    return hash.digest('hex')
  }

  private async compileInteractive(
    rootPath: string,
    manifest: SandboxManifest,
    contentHash: string
  ): Promise<string> {
    const cachePath = safeJoin(
      this.vault.rootPath,
      `${componentCacheRelativeDir}/${contentHash}.js`
    )

    try {
      return await readFile(cachePath, 'utf8')
    } catch {
      // Cache miss: compile below.
    }

    const script = await this.buildInteractiveBundle({ rootPath, manifest })

    await mkdir(dirname(cachePath), { recursive: true })
    await writeFile(cachePath, script, 'utf8')
    return script
  }

  /** Shared esbuild driver used by both the live-component compile path and
   *  the AI "compile a draft without writing it" path. The cache decision is
   *  left to the caller — live path caches; the draft path discards. */
  private async buildInteractiveBundle({
    rootPath,
    manifest
  }: {
    rootPath: string
    manifest: SandboxManifest
  }): Promise<string> {
    try {
      const result = await build({
        absWorkingDir: rootPath,
        bundle: true,
        format: 'iife',
        globalName: 'MdxVaultInteractiveBundle',
        jsx: 'automatic',
        legalComments: 'none',
        logLevel: 'silent',
        nodePaths: getCompilerNodePaths(),
        platform: 'browser',
        sourcemap: false,
        target: 'es2022',
        write: false,
        stdin: {
          contents: createInteractiveRunnerSource(),
          loader: 'tsx',
          resolveDir: rootPath,
          sourcefile: 'mdx-vault-runner.tsx'
        },
        plugins: [createDependencyGuardPlugin(rootPath, manifest)]
      })

      const script = result.outputFiles[0]?.text

      if (!script) {
        throw new Error('esbuild did not return an output file')
      }

      return script
    } catch (error) {
      throw new Error(formatBuildError(error))
    }
  }

  private async readPermissionStore(): Promise<PermissionStore> {
    const storePath = safeJoin(this.vault.rootPath, permissionStoreRelativePath)

    try {
      const raw = await readFile(storePath, 'utf8')
      return permissionStoreSchema.parse(JSON.parse(raw))
    } catch (error) {
      if (isNotFoundError(error)) {
        return createEmptyPermissionStore()
      }

      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        return createEmptyPermissionStore()
      }

      throw error
    }
  }

  private async writePermissionStore(store: PermissionStore): Promise<void> {
    const storePath = safeJoin(this.vault.rootPath, permissionStoreRelativePath)
    const tempPath = `${storePath}.tmp-${process.pid}-${Date.now()}`

    await mkdir(dirname(storePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(tempPath, storePath)
  }
}

function createSandboxHtmlDocument({
  title,
  instanceId,
  bodyHtml,
  runtimeScript
}: {
  title: string
  instanceId: string
  bodyHtml: string
  runtimeScript: string
}): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(sandboxCsp)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
html, body { margin: 0; min-height: 100%; background: transparent; color: #111827; }
body { overflow: hidden; }
#root { min-height: 1px; }
button, input, select, textarea { font: inherit; }
</style>
</head>
<body>
${bodyHtml}
<script>
${createSandboxBootstrapScript(instanceId)}
</script>
${runtimeScript ? `<script>\n${runtimeScript}\n</script>` : ''}
</body>
</html>`
}

function createSandboxBootstrapScript(instanceId: string): string {
  return `
(function () {
  var channel = 'mdx-vault';
  var instanceId = ${JSON.stringify(instanceId)};
  var pendingRequests = new Map();
  var nextRequestId = 1;

  function post(message) {
    window.parent.postMessage(Object.assign({ channel: channel, instanceId: instanceId }, message), '*');
  }

  function measureHeight() {
    var body = document.body;
    var element = document.documentElement;
    return Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      element ? element.scrollHeight : 0,
      element ? element.offsetHeight : 0,
      80
    );
  }

  function postResize() {
    post({ type: 'resize', height: Math.ceil(measureHeight()) });
  }

  window.mdxVault = Object.freeze({
    requestData: function requestData(path) {
      return new Promise(function (resolve, reject) {
        if (typeof path !== 'string' || path.length === 0) {
          reject(new Error('requestData(path) requires a non-empty string path'));
          return;
        }

        var requestId = String(nextRequestId++);
        pendingRequests.set(requestId, { resolve: resolve, reject: reject });
        post({ type: 'requestData', requestId: requestId, path: path });
      });
    }
  });

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) {
      return;
    }

    var message = event.data;
    if (!message || message.channel !== channel || message.instanceId !== instanceId) {
      return;
    }

    if (message.type === 'dataResponse') {
      var pending = pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }

      pendingRequests.delete(message.requestId);
      if (message.ok === true) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(String(message.error || 'Dataset request failed')));
      }
    }
  });

  window.addEventListener('load', postResize);

  if ('ResizeObserver' in window) {
    new ResizeObserver(postResize).observe(document.documentElement);
  } else {
    window.setInterval(postResize, 500);
  }

  post({ type: 'ready' });
  postResize();
})();
`
}

function createInteractiveRunnerSource(): string {
  return `
import React from 'react'
import { createRoot } from 'react-dom/client'
import Component from './component.tsx'

const channel = 'mdx-vault'
let root = null

function isInitMessage(message) {
  return Boolean(
    message &&
      message.channel === channel &&
      message.type === 'init' &&
      typeof message.instanceId === 'string' &&
      'props' in message
  )
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || !isInitMessage(event.data)) {
    return
  }

  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Interactive root element is missing')
  }

  if (!root) {
    root = createRoot(rootElement)
  }

  root.render(React.createElement(Component, event.data.props))
})
`
}

function createDependencyGuardPlugin(rootPath: string, manifest: SandboxManifest): Plugin {
  const declaredDependencies = new Set(Object.keys(manifest.dependencies))

  return {
    name: 'mdx-vault-dependency-guard',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^[^./]|^\.[^./]|^\// }, (args) => {
        const resolveDirectory = args.resolveDir || rootPath

        if (!isPathInside(rootPath, resolveDirectory)) {
          return null
        }

        if (isAbsoluteSpecifier(args.path)) {
          return {
            errors: [{ text: 'absolute imports are not allowed in sandbox interactives' }]
          }
        }

        const packageName = getPackageName(args.path)

        if (!packageName) {
          return null
        }

        if (!dependencyAllowlist.has(packageName)) {
          return {
            errors: [{ text: `dependency not allowed: ${packageName}` }]
          }
        }

        if (!declaredDependencies.has(packageName) && packageName !== 'react') {
          return {
            errors: [{ text: `dependency must be declared in manifest.json: ${packageName}` }]
          }
        }

        return null
      })

      buildApi.onResolve({ filter: /^\.+[\\/]/ }, (args) => {
        const resolveDirectory = args.resolveDir || rootPath

        if (!isPathInside(rootPath, resolveDirectory)) {
          return null
        }

        const resolvedBase = resolve(resolveDirectory, args.path)

        if (!isPathInside(rootPath, resolvedBase)) {
          return {
            errors: [{ text: 'local imports must stay inside the interactive folder' }]
          }
        }

        return null
      })
    }
  }
}

function validateProps(manifest: SandboxManifest, props: unknown): void {
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    if (Object.keys(manifest.propsSchema).length === 0) {
      return
    }

    throw new Error('Interactive props must be an object')
  }

  const input = props as Record<string, unknown>
  const allowedKeys = new Set(Object.keys(manifest.propsSchema))
  const extraKey = Object.keys(input).find((key) => !allowedKeys.has(key))

  if (extraKey) {
    throw new Error(`Unknown interactive prop: ${extraKey}`)
  }

  for (const [key, expectedType] of Object.entries(manifest.propsSchema)) {
    const value = input[key]

    if (!matchesManifestType(value, expectedType)) {
      throw new Error(`Invalid prop "${key}": expected ${expectedType}`)
    }
  }
}

function matchesManifestType(value: unknown, expectedType: string): boolean {
  if (expectedType === 'array') {
    return Array.isArray(value)
  }

  if (expectedType === 'object') {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
  }

  if (expectedType === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
  }

  if (expectedType === 'string' || expectedType === 'boolean') {
    return typeof value === expectedType
  }

  return false
}

function normalizeVaultReference(input: string, notePath: string | null): string {
  const normalizedInput = input.trim().replaceAll('\\', '/')

  if (!normalizedInput) {
    throw new Error('Sandbox src cannot be empty')
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedInput) || normalizedInput.startsWith('/')) {
    throw new Error('Sandbox paths must be vault-relative')
  }

  const baseDirectory =
    normalizedInput.startsWith('.') && notePath
      ? pathPosix.dirname(notePath.replaceAll('\\', '/'))
      : ''
  const resolved = pathPosix.normalize(
    baseDirectory ? `${baseDirectory}/${normalizedInput}` : normalizedInput
  )
  const clean = resolved.replace(/^\.\//, '')

  if (clean === '..' || clean.startsWith('../')) {
    throw new Error('Sandbox path escapes the vault root')
  }

  return clean
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function isInteractiveVaultPath(relativePath: string): boolean {
  return relativePath.startsWith('interactives/') && relativePath !== 'interactives/'
}

function hashParts(parts: string[]): string {
  const hash = createHash('sha256')

  for (const part of parts) {
    hash.update(part)
    hash.update('\0')
  }

  return hash.digest('hex')
}

function permissionKey(kind: SandboxKind, resolvedPath: string, contentHash: string): string {
  return `${kind}:${resolvedPath}:${contentHash}`
}

function createEmptyPermissionStore(): PermissionStore {
  return {
    version: 1,
    decisions: {}
  }
}

function getPackageName(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/') || isAbsoluteSpecifier(specifier)) {
    return null
  }

  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return scope && name ? `${scope}/${name}` : specifier
  }

  return specifier.split('/')[0]
}

function isAbsoluteSpecifier(specifier: string): boolean {
  return specifier.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(specifier)
}

function isPathInside(rootPath: string, targetPath: string): boolean {
  const resolvedRoot = resolve(rootPath)
  const resolvedTarget = resolve(targetPath)
  const relativePath = relative(resolvedRoot, resolvedTarget)

  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

function getCompilerNodePaths(): string[] {
  const candidates = [
    resolve(process.cwd(), 'node_modules'),
    resolve(__dirname, '../../node_modules'),
    resolve(__dirname, '../node_modules')
  ]

  return Array.from(new Set(candidates))
}

async function assertFile(path: string, message: string): Promise<void> {
  try {
    const fileStats = await stat(path)

    if (!fileStats.isFile()) {
      throw new Error(message)
    }
  } catch {
    throw new Error(message)
  }
}

async function assertDirectory(path: string, message: string): Promise<void> {
  try {
    const fileStats = await stat(path)

    if (!fileStats.isDirectory()) {
      throw new Error(message)
    }
  } catch {
    throw new Error(message)
  }
}

async function assertPathInsideVault(vaultRoot: string, targetPath: string): Promise<void> {
  try {
    const [resolvedRoot, resolvedTarget] = await Promise.all([
      realpath(vaultRoot),
      realpath(targetPath)
    ])

    if (!isPathInside(resolvedRoot, resolvedTarget)) {
      throw new Error('Sandbox path resolves outside the vault root')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Sandbox path resolves outside the vault root'
    ) {
      throw error
    }

    throw new Error('Sandbox path could not be resolved safely')
  }
}

async function assertNoSymbolicLinks(rootPath: string): Promise<void> {
  const entries = await readdir(rootPath, { recursive: true })

  for (const entry of entries) {
    const entryPath = resolve(rootPath, entry)

    if ((await lstat(entryPath)).isSymbolicLink()) {
      throw new Error('Symbolic links are not allowed in sandbox interactives')
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

function formatBuildError(error: unknown): string {
  if (error instanceof Error && 'errors' in error) {
    const buildErrors = (error as { errors?: Array<{ text?: string }> }).errors
    const message = buildErrors
      ?.map((entry) => entry.text)
      .filter(Boolean)
      .join('; ')

    if (message) {
      return message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}
