import '@fontsource/ibm-plex-sans-thai/300.css'
import '@fontsource/ibm-plex-sans-thai/400.css'
import '@fontsource/ibm-plex-sans-thai/500.css'
import '@fontsource/ibm-plex-sans-thai/600.css'
import '@fontsource-variable/outfit'
import '@fontsource-variable/sora'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './assets/main.css'
import './assets/screens.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import MiniApp from './MiniApp'

// The mini window loads the same page with #mini.
const isMini = window.location.hash === '#mini'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isMini ? <MiniApp /> : <App />}</StrictMode>
)
