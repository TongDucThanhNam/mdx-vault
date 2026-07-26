import type { InteractiveDiagnostic } from '../../../shared/interactive-authoring'
import type { TextFileRevealRequest } from '../editor/TextFileEditor'

interface InteractiveProblemNavigationDependencies {
  openOrActivate: (relativePath: string) => Promise<boolean>
  reveal: (request: Omit<TextFileRevealRequest, 'requestId'>) => void
}

export async function navigateInteractiveProblem(
  diagnostic: InteractiveDiagnostic,
  dependencies: InteractiveProblemNavigationDependencies
): Promise<boolean> {
  if (!diagnostic.relativePath || !(await dependencies.openOrActivate(diagnostic.relativePath))) {
    return false
  }
  if (diagnostic.from !== null && diagnostic.to !== null) {
    dependencies.reveal({ from: diagnostic.from, to: diagnostic.to })
  }
  return true
}
