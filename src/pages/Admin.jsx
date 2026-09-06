import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TitleBar from '../components/TitleBar.jsx'
import Taskbar from '../components/Taskbar.jsx'
import { fmtTime, slugifyFilename } from '../lib/format.js'
import { supabase, isConfigured, TRACKS_BUCKET } from '../lib/supabaseClient.js'

function readAudioDuration(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const a = new Audio()
      a.preload = 'metadata'
      a.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null)
      }
      a.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      a.src = url
    } catch {
      resolve(null)
    }
  })
}

export default function Admin() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <div className="screen">
      <div className="window outset">
        <TitleBar title="ArchiveVault — Admin" />
        <div className="window-body">
          <div className="panel groove">
            <div className="panel-head">
              <h2>Admin</h2>
              <Link className="btn outset" to="/">◄ Back to player</Link>
            </div>

            {!isConfigured && (
              <div className="error">
                Supabase anon key is not set. Add <code>VITE_SUPABASE_ANON_KEY</code> to your
                <code>.env</code> (local) or repo variables (deploy) and rebuild.
              </div>
            )}

            {!authReady && <p>Checking session…</p>}
            {authReady && !session && <LoginForm />}
            {authReady && session && <AdminConsole email={session.user?.email} />}
          </div>
        </div>
      </div>
      <Taskbar status={session ? `Signed in as ${session.user?.email}` : 'Admin — signed out'} />
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <p className="notice">
        Sign in with the admin account. Create it once in the Supabase dashboard under
        <em> Authentication → Users → Add user</em>.
      </p>
      <label>
        Email
        <input type="email" autoComplete="username" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" autoComplete="current-password" value={password}
               onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {err && <div className="error">{err}</div>}
      <button className="btn outset" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

function AdminConsole({ email }) {
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [notes, setNotes] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // {kind, text}

  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(true)

  async function refresh() {
    setLoadingRows(true)
    const { data, error } = await supabase
      .from('tracks')
      .select('id, title, subtitle, storage_path, duration_seconds, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setLoadingRows(false)
    if (error) { setMsg({ kind: 'error', text: error.message }); return }
    setRows(data || [])
  }

  useEffect(() => { refresh() }, [])

  async function onUpload(e) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg({ kind: 'error', text: 'Choose an audio file first.' }); return }
    if (!title.trim()) { setMsg({ kind: 'error', text: 'Title is required.' }); return }

    setBusy(true)
    setMsg({ kind: 'notice', text: 'Reading file…' })

    const duration = await readAudioDuration(file)
    const path = slugifyFilename(file.name)

    setMsg({ kind: 'notice', text: 'Uploading audio…' })
    const up = await supabase.storage.from(TRACKS_BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'audio/mpeg',
      upsert: false,
    })
    if (up.error) { setBusy(false); setMsg({ kind: 'error', text: up.error.message }); return }

    setMsg({ kind: 'notice', text: 'Saving track…' })
    const ins = await supabase.from('tracks').insert({
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      notes: notes.trim() || null,
      storage_path: path,
      duration_seconds: duration,
      sort_order: Number(sortOrder) || 0,
    })
    setBusy(false)
    if (ins.error) {
      // best-effort cleanup so we don't leave an orphan object
      await supabase.storage.from(TRACKS_BUCKET).remove([path])
      setMsg({ kind: 'error', text: ins.error.message })
      return
    }

    setMsg({ kind: 'ok', text: `Added "${title.trim()}".` })
    setTitle(''); setSubtitle(''); setNotes(''); setSortOrder(0)
    if (fileRef.current) fileRef.current.value = ''
    refresh()
  }

  async function onDelete(row) {
    if (!window.confirm(`Delete "${row.title}"? This removes the audio file too.`)) return
    setBusy(true)
    const del = await supabase.from('tracks').delete().eq('id', row.id)
    if (del.error) { setBusy(false); setMsg({ kind: 'error', text: del.error.message }); return }
    await supabase.storage.from(TRACKS_BUCKET).remove([row.storage_path])
    setBusy(false)
    setMsg({ kind: 'ok', text: `Deleted "${row.title}".` })
    refresh()
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel-head">
        <span className="muted">Signed in as <strong>{email}</strong></span>
        <button className="btn outset" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>

      <form className="form-grid" onSubmit={onUpload}>
        <h3 style={{ margin: 0 }}>Add a track</h3>
        <label>
          Audio file (MP3 / WAV / etc.)
          <input ref={fileRef} type="file" accept="audio/*" required />
        </label>
        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Subtitle / take <span className="muted">(optional)</span>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </label>
        <label>
          Liner notes <span className="muted">(optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label>
          Sort order <span className="muted">(lower = earlier)</span>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
        {msg && <div className={msg.kind}>{msg.text}</div>}
        <button className="btn outset" disabled={busy}>{busy ? 'Working…' : 'Upload track'}</button>
      </form>

      <div>
        <h3 style={{ marginBottom: 4 }}>Tracks in the vault</h3>
        {loadingRows ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Nothing uploaded yet.</p>
        ) : (
          <table className="admin-track-list">
            <thead>
              <tr><th>#</th><th>Title</th><th>Length</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.sort_order}</td>
                  <td>{r.title}{r.subtitle ? ` — ${r.subtitle}` : ''}</td>
                  <td>{fmtTime(r.duration_seconds)}</td>
                  <td>
                    <button className="btn outset" disabled={busy} onClick={() => onDelete(r)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
