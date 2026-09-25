#!/usr/bin/env bun

const MINIMUM_BUN_VERSION = '1.4.0'
const EXPECTED_PACKAGE_MANAGER = 'bun@1.4.0'
const projectRoot = new URL('../', import.meta.url)

if (!Bun.semver.satisfies(Bun.version, `>=${MINIMUM_BUN_VERSION}`)) {
  throw new Error(
    `mdx-vault requires Bun ${MINIMUM_BUN_VERSION} or newer; current runtime is ${Bun.version}.`
  )
}

const packageJson = (await Bun.file(new URL('package.json', projectRoot)).json()) as {
  packageManager?: string
}

if (packageJson.packageManager !== EXPECTED_PACKAGE_MANAGER) {
  throw new Error(
    `package.json must pin ${EXPECTED_PACKAGE_MANAGER}; found ${packageJson.packageManager ?? 'no packageManager field'}.`
  )
}

const lockfile = Bun.file(new URL('bun.lock', projectRoot))
if (!(await lockfile.exists())) {
  throw new Error('bun.lock is required. Do not install dependencies with npm, pnpm, or Yarn.')
}

const foreignLockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
const existingForeignLockfiles: string[] = []
for (const lockfileName of foreignLockfiles) {
  if (await Bun.file(new URL(lockfileName, projectRoot)).exists()) {
    existingForeignLockfiles.push(lockfileName)
  }
}

if (existingForeignLockfiles.length > 0) {
  throw new Error(`Remove non-Bun lockfiles: ${existingForeignLockfiles.join(', ')}`)
}

const electronRuntimeGlob = new Bun.Glob('src/{main,preload,renderer}/**/*.{ts,tsx}')
const bunOnlyUsage: string[] = []
for await (const relativePath of electronRuntimeGlob.scan({
  cwd: Bun.fileURLToPath(projectRoot),
  dot: true,
  onlyFiles: true
})) {
  const source = await Bun.file(new URL(relativePath.replaceAll('\\', '/'), projectRoot)).text()
  if (/\bBun\s*\.|\bfrom\s+['"]bun:/u.test(source)) {
    bunOnlyUsage.push(relativePath.replaceAll('\\', '/'))
  }
}

if (bunOnlyUsage.length > 0) {
  throw new Error(
    `Bun-only APIs cannot run inside packaged Electron code: ${bunOnlyUsage.join(', ')}`
  )
}

console.log(
  `Bun ${Bun.version} ready: package manager pinned, bun.lock present, Electron runtime boundary clean.`
)
