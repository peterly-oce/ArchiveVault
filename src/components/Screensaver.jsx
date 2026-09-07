import { useEffect, useRef, useState } from 'react'

// Ambient "archive status" screensaver. Any input wakes it, except Space,
// which toggles a hold so the readout can be looked at without dismissing.
export default function Screensaver({ stats, onWake }) {
  const [held, setHeld] = useState(false)
  const heldRef = useRef(false)
  useEffect(() => { heldRef.current = held }, [held])

  useEffect(() => {
    const wake = () => { if (!heldRef.current) onWake() }
    const isSpace = (e) =>
      e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32
    const onKey = (e) => {
      if (isSpace(e)) {
        e.preventDefault()
        setHeld((h) => !h)
      } else {
        wake()
      }
    }
    const moves = ['mousemove', 'mousedown', 'wheel', 'touchstart']
    moves.forEach((m) => window.addEventListener(m, wake, { passive: true }))
    window.addEventListener('keydown', onKey)
    return () => {
      moves.forEach((m) => window.removeEventListener(m, wake))
      window.removeEventListener('keydown', onKey)
    }
  }, [onWake])

  const { objects = 0, onDisc = '—', lastSealed = '—' } = stats || {}

  return (
    <div className="screensaver2" role="presentation">
      <div className="ss2-disc" />
      <div className="ss2-orbit" />

      <div className={'ss2-card' + (held ? ' held' : '')}>
        <div className="ss2-title">ARCHIVE VAULT</div>
        <div className="ss2-sub">SEALED · {held ? 'HELD' : 'IDLE'}</div>

        <dl className="ss2-stats">
          <div><dt>Objects</dt><dd>{objects.toLocaleString()}</dd></div>
          <div><dt>On disc</dt><dd>{onDisc}</dd></div>
          <div><dt>Last sealed</dt><dd>{lastSealed}</dd></div>
          <div><dt>Integrity</dt><dd className="ok">OK</dd></div>
        </dl>

        <p className="ss2-hint">
          Screensaver active. Move the mouse or press a key to wake —{' '}
          <kbd>Space</kbd> {held ? 'is holding it.' : 'holds it.'}
        </p>
      </div>
    </div>
  )
}
