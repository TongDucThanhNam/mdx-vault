export const mermaidSecureConfig = {
  startOnLoad: false,
  securityLevel: 'strict',
  secure: [
    'secure',
    'securityLevel',
    'startOnLoad',
    'maxTextSize',
    'suppressErrorRendering',
    'maxEdges'
  ],
  maxTextSize: 50_000,
  suppressErrorRendering: true,
  theme: 'base',
  darkMode: false,
  htmlLabels: false,
  themeVariables: {
    background: '#f9f9f7',
    primaryColor: '#ffffff',
    primaryTextColor: '#111111',
    primaryBorderColor: '#111111',
    secondaryColor: '#efefea',
    tertiaryColor: '#ffffff',
    lineColor: '#111111',
    textColor: '#111111',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
  },
  flowchart: {
    htmlLabels: false
  }
} as const
