import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useAtlas } from './state/store'
import { runtime } from './state/runtime'

if (import.meta.env.DEV) {
  // Handles for manual debugging and automated UI checks in development only.
  Object.assign(window, { __atlas: useAtlas, __runtime: runtime })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
