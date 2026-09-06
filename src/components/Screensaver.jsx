import { useEffect, useRef, useState } from 'react'

const COLORS = ['#ffe94d', '#4ce08a', '#ff5db1', '#5db8ff', '#ff9f43', '#c98bff']

// Classic "bouncing logo" screensaver — hits a wall, changes colour.
export default function Screensaver({ onWake }) {
  const boxRef = useRef(null)
  const logoRef = useRef(null)
  const [color, setColor] = useState(COLORS[0])

  useEffect(() => {
    const box = boxRef.current
    const logo = logoRef.current
    if (!box || !logo) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let x = Math.max(0, (box.clientWidth - logo.offsetWidth) / 2)
    let y = Math.max(0, (box.clientHeight - logo.offsetHeight) / 2)
    logo.style.transform = `translate(${x}px, ${y}px)`
    if (reduced) return

    let vx = 1.7
    let vy = 1.3
    let ci = 0
    let raf

    const step = () => {
      const maxX = box.clientWidth - logo.offsetWidth
      const maxY = box.clientHeight - logo.offsetHeight
      x += vx
      y += vy
      let hit = false
      if (x <= 0) { x = 0; vx = Math.abs(vx); hit = true }
      else if (x >= maxX) { x = maxX; vx = -Math.abs(vx); hit = true }
      if (y <= 0) { y = 0; vy = Math.abs(vy); hit = true }
      else if (y >= maxY) { y = maxY; vy = -Math.abs(vy); hit = true }
      if (hit) { ci = (ci + 1) % COLORS.length; setColor(COLORS[ci]) }
      logo.style.transform = `translate(${x}px, ${y}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className="screensaver"
      ref={boxRef}
      onPointerDown={onWake}
      role="presentation"
    >
      <div className="ss-stars" />
      <div className="ss-logo" ref={logoRef} style={{ color, borderColor: color }}>
        ArchiveVault
      </div>
      <div className="ss-hint">move the mouse to resume</div>
    </div>
  )
}
