export interface GraphRequestToken {
  id: number
}

export interface GraphRequestCoordinator {
  begin: () => GraphRequestToken
  isCurrent: (token: GraphRequestToken) => boolean
  invalidate: () => void
}

export function createGraphRequestCoordinator(): GraphRequestCoordinator {
  let currentId = 0
  return {
    begin: () => {
      currentId += 1
      return { id: currentId }
    },
    isCurrent: (token) => token.id === currentId,
    invalidate: () => {
      currentId += 1
    }
  }
}
