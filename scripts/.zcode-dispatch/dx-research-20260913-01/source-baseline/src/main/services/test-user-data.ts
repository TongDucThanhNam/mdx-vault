import { realpathSync } from 'fs'
import { tmpdir } from 'os'
import { isAbsolute, relative, resolve } from 'path'

export const TEST_USER_DATA_ENV = 'MDX_VAULT_TEST_USER_DATA'

interface UserDataApp {
  isPackaged: boolean
  setPath(name: 'userData', path: string): void
}

export function configureDisposableUserData(
  electronApp: UserDataApp,
  requestedPath = process.env[TEST_USER_DATA_ENV]
): string | null {
  if (!requestedPath || electronApp.isPackaged) {
    return null
  }

  const verifiedPath = resolveDisposableUserDataPath(requestedPath)
  electronApp.setPath('userData', verifiedPath)
  return verifiedPath
}

export function resolveDisposableUserDataPath(
  requestedPath: string,
  temporaryRoot = tmpdir()
): string {
  if (!isAbsolute(requestedPath)) {
    throw new Error(`${TEST_USER_DATA_ENV} must be an absolute path`)
  }

  const root = realpathSync(temporaryRoot)
  const candidate = resolve(requestedPath)
  assertChildOfTemporaryRoot(root, candidate)
  const verifiedCandidate = realpathSync(candidate)
  assertChildOfTemporaryRoot(root, verifiedCandidate)

  return verifiedCandidate
}

function assertChildOfTemporaryRoot(root: string, candidate: string): void {
  const pathFromRoot = relative(root, candidate)

  if (
    pathFromRoot === '' ||
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error(`${TEST_USER_DATA_ENV} must point to a child directory of the OS temp folder`)
  }
}
