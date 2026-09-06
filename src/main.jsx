import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Player from './pages/Player.jsx'
import Admin from './pages/Admin.jsx'
import './styles/retro.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Player />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Player />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
