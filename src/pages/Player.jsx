import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TitleBar from '../components/TitleBar.jsx'
import Taskbar from '../components/Taskbar.jsx'
import DancingHamster from '../components/DancingHamster.jsx'
import SpinningLogo from '../components/SpinningLogo.jsx'
import Screensaver from '../components/Screensaver.jsx'
import Teleprompter from '../components/Teleprompter.jsx'
import { fmtTime } from '../lib/format.js'
import { supabase, isConfigured, publicAudioUrl } from '../lib/supabaseClient.js'

const IDLE_MS = 60_000

export default function Player() {
  const audioRef = useRef(null)
  const [tracks, setTracks] = useState([])
  const [loadState, setLoadState] = useState('loading') // loading | ready | empty | error
  const [errorMsg, setErrorMsg] = useState('')

  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [status, setStatus] = useState('ArchiveVault ready.')

  // Teleprompter — off by default; remembers the viewer's last choice.
  const [showLyrics, setShowLyrics] = useState(() => {
    try { return localStorage.getItem('av:lyrics') === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('av:lyrics', showLyrics ? '1' : '0') } catch { /* ignore */ }
  }, [showLyrics])

  // Screensaver after IDLE_MS with no input; any input wakes it.
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let timer
    const arm = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), IDLE_MS)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel']
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, arm))
    }
  }, [])

  const current = index >= 0 ? tracks[index] : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isConfigured) {
        setLoadState('error')
        setErrorMsg('Supabase anon key is not set. Add VITE_SUPABASE_ANON_KEY and rebuild.')
        return
      }
      // select('*') so a not-yet-migrated DB (no `collection` column) still works
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) {
        setLoadState('error')
        setErrorMsg(error.message)
        return
      }
      setTracks(data || [])
      setLoadState((data || []).length ? 'ready' : 'empty')
      setStatus((data || []).length ? `${data.length} track(s) loaded.` : 'No tracks yet.')
    }
    load()
    return () => { cancelled = true }
  }, [])

  // keep <audio> volume synced
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const loadTrack = useCallback((i, autoplay = true) => {
    if (i < 0 || i >= tracks.length) return
    setIndex(i)
    setTime(0)
    setDuration(0)
    const el = audioRef.current
    if (!el) return
    el.src = publicAudioUrl(tracks[i].storage_path)
    el.load()
    if (autoplay) {
      el.play().then(() => setPlaying(true)).catch(() => {
        setPlaying(false)
        setStatus('Press PLAY to start (browser blocked autoplay).')
      })
    }
    setStatus(`Loaded: ${tracks[i].title}`)
  }, [tracks])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (index === -1 && tracks.length) { loadTrack(0, true); return }
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => setStatus('Playback failed.'))
    } else {
      el.pause()
      setPlaying(false)
    }
  }, [index, tracks.length, loadTrack])

  const pause = useCallback(() => {
    const el = audioRef.current
    if (el && !el.paused) { el.pause(); setPlaying(false) }
  }, [])

  const next = useCallback(() => {
    if (!tracks.length) return
    loadTrack((index + 1) % tracks.length, true)
  }, [index, tracks.length, loadTrack])

  const prev = useCallback(() => {
    if (!tracks.length) return
    const el = audioRef.current
    if (el && el.currentTime > 3) { el.currentTime = 0; return }
    loadTrack((index - 1 + tracks.length) % tracks.length, true)
  }, [index, tracks.length, loadTrack])

  const onSeek = (e) => {
    const el = audioRef.current
    const v = Number(e.target.value)
    if (el && Number.isFinite(duration)) {
      el.currentTime = (v / 1000) * duration
      setTime(el.currentTime)
    }
  }

  // Group the playlist by `collection` for display only — playback still walks
  // the flat `tracks` array in DB order, so Next/Prev flow across groups.
  const grouped = useMemo(() => {
    const map = new Map()
    tracks.forEach((t, i) => {
      const key = (t.collection || '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push({ t, i })
    })
    const minSort = (items) => Math.min(...items.map((x) => x.t.sort_order ?? 0))
    return [...map.entries()].sort((a, b) => {
      if (!a[0]) return 1 // loose tracks last
      if (!b[0]) return -1
      return minSort(a[1]) - minSort(b[1]) || a[0].localeCompare(b[0])
    })
  }, [tracks])

  const stateLabel = loadState === 'error'
    ? 'ERROR'
    : !current
      ? 'STOPPED'
      : playing
        ? 'PLAYING'
        : 'PAUSED'

  const seekValue = duration > 0 ? Math.round((time / duration) * 1000) : 0

  return (
    <div className="screen">
      <div className="window outset">
        <TitleBar title="ArchiveVault — Unreleased Tracks" />
        <div className="window-body">

          {/* NOW PLAYING ---------------------------------------------------- */}
          <div className="panel groove">
            <div className="panel-head">
              <h2>Now Playing</h2>
              <span className="tag inset">UNRELEASED · MP3 / WAV</span>
            </div>

            <div className="lcd inset">
              <div>
                <div className="lcd-title">{current ? current.title : 'No track selected'}</div>
                {current?.subtitle && <div className="lcd-sub">{current.subtitle}</div>}
              </div>
              <div className="lcd-row">
                <span>{fmtTime(time)} / {fmtTime(duration)}</span>
                <span className="lcd-state">{stateLabel}</span>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="field-label">Track position</div>
              <input
                type="range"
                min="0"
                max="1000"
                value={seekValue}
                onChange={onSeek}
                disabled={!current}
                aria-label="Track position"
              />
            </div>

            <div className="transport" style={{ marginTop: 8 }}>
              <button className="btn outset" onClick={prev} disabled={!tracks.length}>◄◄ Prev</button>
              <button className="btn outset" onClick={togglePlay} disabled={!tracks.length}>
                {playing ? '❚❚ Pause' : '► Play'}
              </button>
              <button className="btn outset" onClick={pause} disabled={!playing}>■ Stop</button>
              <button className="btn outset" onClick={next} disabled={!tracks.length}>►► Next</button>
              <button
                className="btn outset"
                onClick={() => setShowLyrics((v) => !v)}
                aria-pressed={showLyrics}
              >
                📜 Lyrics
              </button>
              <span className="spacer" />
              <div className="volume-wrap">
                <span className="field-label">🔊 Volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>

          {/* LOWER GRID --------------------------------------------------- */}
          <div className="lower">
            <div className="panel groove">
              <div className="panel-head"><h3>Liner Notes</h3></div>
              <div className="notes-body inset">
                {current
                  ? (current.notes || 'No notes for this track.')
                  : <span className="muted">Select a track from the playlist to see its notes.</span>}
              </div>
            </div>

            <div className="panel groove">
              <div className="panel-head">
                <h3>Playlist</h3>
                <span className="tag inset">{tracks.length} track(s)</span>
              </div>

              {loadState === 'error' && (
                <div className="error">{errorMsg}</div>
              )}

              {loadState === 'loading' && (
                <div className="playlist-empty">Loading tracks…</div>
              )}

              {loadState === 'empty' && (
                <div className="playlist-empty">
                  <strong>The vault is empty</strong>
                  <span>Upload tracks from the Admin page.</span>
                </div>
              )}

              {loadState === 'ready' && (
                <div className="playlist inset">
                  {grouped.map(([name, items]) => (
                    <div className="pl-group-block" key={name || '__loose'}>
                      {(name || grouped.length > 1) && (
                        <div className="pl-group">{name || 'Loose tracks'}</div>
                      )}
                      <ol>
                        {items.map(({ t, i }) => (
                          <li
                            key={t.id}
                            className={i === index ? 'active' : ''}
                            onClick={() => loadTrack(i, true)}
                          >
                            <span className="idx">{i + 1}.</span>
                            <span className="pl-title">
                              {t.title}
                              {t.subtitle ? <span className="muted"> — {t.subtitle}</span> : null}
                            </span>
                            <span className="pl-dur">{fmtTime(t.duration_seconds)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={next}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => { setStatus('Audio failed to load.'); setPlaying(false) }}
      />

      {showLyrics && (
        <Teleprompter
          track={current}
          time={time}
          duration={duration}
          onClose={() => setShowLyrics(false)}
        />
      )}

      <SpinningLogo />
      <DancingHamster />
      <Taskbar status={status} />

      {idle && <Screensaver onWake={() => setIdle(false)} />}
    </div>
  )
}
