const NOTE_EXTENSION = /\.(?:md|mdx)$/iu
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|svg)$/iu
const EDITABLE_TEXT_EXTENSION =
  /\.(?:txt|csv|tsv|json|jsonc|ya?ml|toml|xml|html|css|jsx?|tsx?|mjs|cjs|py|sh|sql|log|ini)$/iu

export function isNotePath(relativePath: string | null): relativePath is string {
  return relativePath !== null && NOTE_EXTENSION.test(relativePath)
}

export function isEditableTextPath(relativePath: string | null): relativePath is string {
  return relativePath !== null && EDITABLE_TEXT_EXTENSION.test(relativePath)
}

export function isPreviewableVaultImagePath(relativePath: string | null): relativePath is string {
  return relativePath !== null && IMAGE_EXTENSION.test(relativePath)
}
