import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtTime } from '../lib/format.js'

export default function Taskbar({ status }) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const navigate = useNavigate()
  const menuRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <>
      {open && (
        <div className="start-menu outset" ref={menuRef}>
          <div className="rail">ArchiveVault</div>
          <ul>
            <li onClick={() => { setOpen(false); navigate('/') }}>▶ &nbsp;Player</li>
            <li onClick={() => { setOpen(false); navigate('/admin') }}>🔑 &nbsp;Admin…</li>
            <li className="sep" />
            <li onClick={() => { setOpen(false); window.open('https://github.com/peterly-oce/ArchiveVault', '_blank') }}>
              🗔 &nbsp;Source
            </li>
          </ul>
        </div>
      )}
      <div className="taskbar outset">
        <button className="btn start-btn outset" onClick={() => setOpen((v) => !v)}>
          ⊞ Start
        </button>
        <div className="status inset">{status}</div>
        <div className="clock inset" title={now.toLocaleString()}>{clock}</div>
      </div>
    </>
  )
}

export { fmtTime }
