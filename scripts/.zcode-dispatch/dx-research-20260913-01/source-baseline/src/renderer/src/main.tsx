// Self-hosted Knowledge Instrument fonts (local-first: no CDN, no relaxed CSP).
// Atkinson = UI, Literata = prose, JetBrains Mono = source, IBM Plex Mono = data.
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/400-italic.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/atkinson-hyperlegible-next/400.css'
import '@fontsource/atkinson-hyperlegible-next/500.css'
import '@fontsource/atkinson-hyperlegible-next/600.css'
import '@fontsource/literata/400.css'
import '@fontsource/literata/400-italic.css'
import '@fontsource/literata/600.css'
import '@fontsource/maple-mono/400.css'
import '@fontsource/maple-mono/400-italic.css'
import '@fontsource/maple-mono/500.css'
import '@fontsource/maple-mono/600.css'
import '@fontsource/maple-mono/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/400-italic.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-mono/700.css'
// Note paper typography. Kept separate from the app chrome and bundled locally.
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/400-italic.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/900.css'
import 'katex/dist/katex.min.css'

import './globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
