import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Fundo global — garante que não sobra espaço branco
document.body.style.margin = '0'
document.body.style.background = '#0a0e1a'
document.body.style.minHeight = 'unset'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
