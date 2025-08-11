import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { enableHotReload, detectNewRoutes } from './utils/dev-helpers'

// Enable development helpers
if (import.meta.env.DEV) {
  enableHotReload();
  detectNewRoutes();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
