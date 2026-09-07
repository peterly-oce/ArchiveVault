import { useEffect, useMemo, useRef, useState } from 'react'

// [mm:ss] or [mm:ss.xx] anywhere on a line.
const TS = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/

// Strip the timestamp token plus common markdown / list noise from a line.
function cleanText(s) {
  return s
    .replace(TS, '')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*#+\s*/, '')
    .replace(/^\s*[-–—]\s+/, '')
    .trim()
}

// Turn the raw lyrics field into timed lines.
//  - If any line carries an [mm:ss] / [mm:ss.xx] stamp -> use those (LRC).
//  - Otherwise spread the non-empty lines evenly across the track length so it
//    still follows along, roughly, with zero extra data entry.
function parseLyrics(raw, duration) {
  if (!raw || !raw.trim()) return { mode: 'none', lines: [] }
  const rawLines = raw.replace(/\r/g, '').split('\n')

  const stamped = []
  for (const line of rawLines) {
    const m = line.match(TS)
    if (!m) continue
    const t = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0)
    stamped.push({ t, text: cleanText(line) })
  }

  if (stamped.length) {
    return { mode: 'lrc', lines: stamped.sort((a, b) => a.t - b.t) }
  }

  const nonEmpty = rawLines.map((t) => cleanText(t)).filter(Boolean)
  const span = duration > 1 ? duration * 0.97 : 0
  return {
    mode: span ? 'even' : 'plain',
    lines: nonEmpty.map((text, i) => ({
      t: span ? (i / nonEmpty.length) * span : 0,
      text,
    })),
  }
}

export default function Teleprompter({ track, time, duration, onClose }) {
  const [follow, setFollow] = useState(true)
  const bodyRef = useRef(null)
  const lineEls = useRef([])

  const { mode, lines } = useMemo(
    () => parseLyrics(track?.lyrics, duration),
    [track?.lyrics, duration],
  )

  const active = useMemo(() => {
    if (mode === 'plain' || !lines.length) return -1
    let i = -1
    for (let n = 0; n < lines.length; n++) {
      if (lines[n].t <= time + 0.15) i = n
      else break
    }
    return i
  }, [lines, mode, time])

  useEffect(() => {
    if (!follow || active < 0) return
    const el = lineEls.current[active]
    const box = bodyRef.current
    if (el && box) {
      box.scrollTo({
        top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2,
        behavior: 'smooth',
      })
    }
  }, [active, follow])

  return (
    <aside className="teleprompter" aria-label="Lyrics teleprompter">
      <div className="tp-bar">
        <span className="tp-title">{track ? track.title : 'Teleprompter'}</span>
        {mode !== 'none' && mode !== 'plain' && (
          <label className="tp-auto" title="Keep the current line centred">
            <input type="checkbox" checked={follow} onChange={() => setFollow((v) => !v)} />
            Follow
          </label>
        )}
        <button className="btn outset" onClick={onClose} aria-label="Close lyrics">✕</button>
      </div>

      <div className="tp-body" ref={bodyRef}>
        {mode === 'none' ? (
          <p className="tp-empty">
            {track ? 'No lyrics for this track.' : 'Select a track to see its lyrics.'}
          </p>
        ) : (
          <div className="tp-lines">
            {lines.map((ln, i) => (
              <p
                key={i}
                ref={(el) => (lineEls.current[i] = el)}
                className={
                  'tp-line' +
                  (i === active ? ' active' : '') +
                  (active >= 0 && i < active ? ' done' : '')
                }
              >
                {ln.text || ' '}
              </p>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
