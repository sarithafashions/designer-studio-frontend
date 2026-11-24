import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Toasts and confirmation popups (SweetAlert2) in the design.md style, for every screen
import './Pages/shared/popups.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
    <App />
)
