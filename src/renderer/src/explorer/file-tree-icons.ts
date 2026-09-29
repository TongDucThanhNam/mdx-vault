/** Symbol definitions must not consume space ahead of the virtualized rows. */
export const FILE_TREE_ICONS = {
  set: 'minimal' as const,
  colored: false,
  spriteSheet: `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="0" height="0">
    <symbol id="vault-mdx" viewBox="0 0 16 16"><path d="M3 1.5h7l3 3V14.5H3zM10 1.5v3h3M5 8h6M5 10.5h6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="10.5" cy="12.5" r="1" fill="currentColor"/></symbol>
    <symbol id="vault-md" viewBox="0 0 16 16"><path d="M3 1.5h7l3 3V14.5H3zM10 1.5v3h3M5 8h6M5 10.5h5" fill="none" stroke="currentColor" stroke-width="1.3"/></symbol>
    <symbol id="vault-image" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/><path d="m3 12 4-4 2 2 2-3 2 4" fill="none" stroke="currentColor" stroke-width="1.2"/></symbol>
    <symbol id="vault-data" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 6h12M6 6v8M10 6v8" fill="none" stroke="currentColor" stroke-width="1.1"/></symbol>
    <symbol id="vault-other" viewBox="0 0 16 16"><path d="M3 1.5h7l3 3V14.5H3zM10 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3"/></symbol>
  </svg>`,
  remap: { 'file-tree-icon-file': 'vault-other' },
  byFileExtension: {
    mdx: 'vault-mdx',
    md: 'vault-md',
    png: 'vault-image',
    jpg: 'vault-image',
    jpeg: 'vault-image',
    gif: 'vault-image',
    webp: 'vault-image',
    svg: 'vault-image',
    json: 'vault-data',
    yaml: 'vault-data',
    yml: 'vault-data',
    csv: 'vault-data',
    tsv: 'vault-data'
  }
}
