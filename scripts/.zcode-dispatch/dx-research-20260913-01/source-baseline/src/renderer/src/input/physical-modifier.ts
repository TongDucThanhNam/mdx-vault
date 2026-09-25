export class PhysicalZoomModifierTracker {
  private controlDown = false
  private metaDown = false

  constructor(private readonly isDarwin: boolean) {}

  keyDown(key: string): void {
    if (key === 'Control') {
      this.controlDown = true
    } else if (this.isDarwin && key === 'Meta') {
      this.metaDown = true
    }
  }

  keyUp(key: string): void {
    if (key === 'Control') {
      this.controlDown = false
    } else if (this.isDarwin && key === 'Meta') {
      this.metaDown = false
    }
  }

  reset(): void {
    this.controlDown = false
    this.metaDown = false
  }

  isDown(): boolean {
    return this.controlDown || this.metaDown
  }
}

interface ReadingWheelZoomDiscriminatorInput {
  ctrlKey: boolean
  metaKey: boolean
  isDarwin: boolean
  physicalModifierDown: boolean
}

export function shouldHandleReadingWheelZoom({
  ctrlKey,
  metaKey,
  isDarwin,
  physicalModifierDown
}: ReadingWheelZoomDiscriminatorInput): boolean {
  const hasZoomModifier = ctrlKey || (isDarwin && metaKey)
  return hasZoomModifier && physicalModifierDown
}
