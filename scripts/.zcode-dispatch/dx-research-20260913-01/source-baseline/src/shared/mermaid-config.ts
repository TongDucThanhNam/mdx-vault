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
    primaryColor: '#f9f9f7',
    primaryTextColor: '#111111',
    primaryBorderColor: '#111111',
    secondaryColor: '#efefea',
    tertiaryColor: '#f9f9f7',
    lineColor: '#111111',
    textColor: '#111111',
    fontFamily: '"Courier Prime", monospace'
  },
  flowchart: {
    htmlLabels: false
  }
} as const
