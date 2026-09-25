export type GraphSurfaceCommand = 'fit-view' | 'toggle-settings'

const GRAPH_COMMAND_EVENT = 'mdx-vault:graph-command'

export function dispatchGraphSurfaceCommand(command: GraphSurfaceCommand): void {
  window.dispatchEvent(
    new CustomEvent<GraphSurfaceCommand>(GRAPH_COMMAND_EVENT, {
      detail: command
    })
  )
}

export function subscribeGraphSurfaceCommands(
  listener: (command: GraphSurfaceCommand) => void
): () => void {
  const handleCommand = (event: Event): void => {
    if (event instanceof CustomEvent && isGraphSurfaceCommand(event.detail)) {
      listener(event.detail)
    }
  }

  window.addEventListener(GRAPH_COMMAND_EVENT, handleCommand)
  return () => window.removeEventListener(GRAPH_COMMAND_EVENT, handleCommand)
}

function isGraphSurfaceCommand(value: unknown): value is GraphSurfaceCommand {
  return value === 'fit-view' || value === 'toggle-settings'
}
