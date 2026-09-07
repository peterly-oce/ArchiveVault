import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TitleBar from '../components/TitleBar.jsx'
import Taskbar from '../components/Taskbar.jsx'
import { fmtTime, slugifyFilename } from '../lib/format.js'
import { supabase, isConfigured, TRACKS_BUCKET } from '../lib/supabaseClient.js'

// PostgREST caches the table schema and can lag a freshly-added column
// ("Could not find the 'X' column of 'tracks' in the schema cache"). Retry the
// write with that column dropped so the track still saves; caller is warned.
async function tolerantWrite(run, data) {
  const payload = { ...data }
  const dropped = []
  for (let i = 0; i < 5; i++) {
    const res = await run(payload)
    const m = /Could not find the '(.+?)' column/.exec(res.error?.message || '')
    if (!m || !(m[1] in payload)) return { ...res, dropped }
    delete payload[m[1]]
    dropped.push(m[1])
  }
  return { ...(await run(payload)), dropped }
}

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

function TrackRow({ row, busy, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [d, setD] = useState(null)

  function start() {
    setD({
      title: row.title || '',
      subtitle: row.subtitle || '',
      collection: row.collection || '',
      notes: row.notes || '',
      lyrics: row.lyrics || '',
      sort_order: row.sort_order ?? 0,
    })
    setEditing(true)
  }

  async function save() {
    if (!d.title.trim()) return
    const ok = await onSave(row.id, {
      title: d.title.trim(),
      subtitle: d.subtitle.trim() || null,
      collection: d.collection.trim() || null,
      notes: d.notes.trim() || null,
      lyrics: d.lyrics.trim() || null,
      sort_order: Number(d.sort_order) || 0,
    })
    if (ok) setEditing(false)
  }

  return (
    <tbody>
      <tr>
        <td>{row.sort_order}</td>
        <td>{row.title}{row.subtitle ? ` — ${row.subtitle}` : ''}</td>
        <td>{row.collection || <span className="muted">—</span>}</td>
        <td>{fmtTime(row.duration_seconds)}</td>
        <td className="row-actions">
          <button className="btn outset" disabled={busy} onClick={editing ? () => setEditing(false) : start}>
            {editing ? 'Close' : 'Edit'}
          </button>
          <button className="btn outset" disabled={busy} onClick={() => onDelete(row)}>Delete</button>
        </td>
      </tr>
      {editing && d && (
        <tr className="track-editor-row">
          <td colSpan={5}>
            <div className="form-grid">
              <label>
                Title
                <input type="text" value={d.title}
                       onChange={(e) => setD({ ...d, title: e.target.value })} />
              </label>
              <label>
                Subtitle / take <span className="muted">(optional)</span>
                <input type="text" value={d.subtitle}
                       onChange={(e) => setD({ ...d, subtitle: e.target.value })} />
              </label>
              <label>
                EP / folder <span className="muted">(optional)</span>
                <input type="text" list="collections-dl" value={d.collection}
                       onChange={(e) => setD({ ...d, collection: e.target.value })} />
              </label>
              <label>
                Liner notes <span className="muted">(optional)</span>
                <textarea value={d.notes}
                          onChange={(e) => setD({ ...d, notes: e.target.value })} />
              </label>
              <label>
                Lyrics <span className="muted">(optional — karaoke panel; one line per line. Prefix a line with [mm:ss] for exact sync)</span>
                <textarea className="lyrics-input" value={d.lyrics}
                          onChange={(e) => setD({ ...d, lyrics: e.target.value })} />
              </label>
              <label>
                Sort order <span className="muted">(lower = earlier)</span>
                <input type="number" value={d.sort_order}
                       onChange={(e) => setD({ ...d, sort_order: e.target.value })} />
              </label>
              <div className="editor-actions">
                <button className="btn outset" disabled={busy || !d.title.trim()} onClick={save}>
                  Save changes
                </button>
                <button className="btn outset" disabled={busy} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  )
}

function AdminConsole({ email }) {
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [notes, setNotes] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [collection, setCollection] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // {kind, text}

  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(true)

  const collections = [...new Set(
    rows.map((r) => (r.collection || '').trim()).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b))

  async function refresh() {
    setLoadingRows(true)
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
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
    const ins = await tolerantWrite(
      (p) => supabase.from('tracks').insert(p),
      {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        notes: notes.trim() || null,
        lyrics: lyrics.trim() || null,
        collection: collection.trim() || null,
        storage_path: path,
        duration_seconds: duration,
        sort_order: Number(sortOrder) || 0,
      },
    )
    setBusy(false)
    if (ins.error) {
      // best-effort cleanup so we don't leave an orphan object
      await supabase.storage.from(TRACKS_BUCKET).remove([path])
      setMsg({ kind: 'error', text: ins.error.message })
      return
    }

    setMsg(ins.dropped.length
      ? { kind: 'notice', text: `Added "${title.trim()}" — but ${ins.dropped.join(', ')} didn't save (run the migration + restart the Supabase project, then re-edit).` }
      : { kind: 'ok', text: `Added "${title.trim()}".` })
    setTitle(''); setSubtitle(''); setNotes(''); setLyrics(''); setSortOrder(0)
    if (fileRef.current) fileRef.current.value = ''
    refresh()
  }

  async function onSave(id, patch) {
    setBusy(true)
    const res = await tolerantWrite(
      (p) => supabase.from('tracks').update(p).eq('id', id),
      patch,
    )
    setBusy(false)
    if (res.error) { setMsg({ kind: 'error', text: res.error.message }); return false }
    setMsg(res.dropped.length
      ? { kind: 'notice', text: `Saved — but ${res.dropped.join(', ')} was skipped (column not in the API cache yet; restart the Supabase project).` }
      : { kind: 'ok', text: `Saved "${patch.title}".` })
    refresh()
    return true
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
          Lyrics <span className="muted">(optional — karaoke panel; one line per line. Prefix a line with [mm:ss] for exact sync)</span>
          <textarea className="lyrics-input" value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
        </label>
        <label>
          EP / folder <span className="muted">(optional — pick one or type a new name)</span>
          <input
            type="text"
            list="collections-dl"
            value={collection}
            placeholder="e.g. Basement Demos"
            onChange={(e) => setCollection(e.target.value)}
          />
          <datalist id="collections-dl">
            {collections.map((c) => <option key={c} value={c} />)}
          </datalist>
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
              <tr><th>#</th><th>Title</th><th>EP / folder</th><th>Length</th><th></th></tr>
            </thead>
            {rows.map((r) => (
              <TrackRow key={r.id} row={r} busy={busy} onSave={onSave} onDelete={onDelete} />
            ))}
          </table>
        )}
      </div>
    </div>
  )
}
