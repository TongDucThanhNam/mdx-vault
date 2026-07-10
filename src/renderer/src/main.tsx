// Self-hosted fonts (local-first: không CDN, không relax CSP).
// Playfair Display = headline, Lora = body serif, Courier Prime = UI mono + code.
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/900.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/400-italic.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
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
