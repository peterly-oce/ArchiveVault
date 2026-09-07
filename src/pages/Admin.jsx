import { useEffect, useMemo, useRef, useState } from 'react'
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

function AdminTrack({ row, pos, busy, dragging, onDragStart, onDragEnd, onDropAt, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [d, setD] = useState(null)

  function start() {
    setD({
      title: row.title || '',
      subtitle: row.subtitle || '',
      collection: row.collection || '',
      notes: row.notes || '',
      lyrics: row.lyrics || '',
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
    })
    if (ok) setEditing(false)
  }

  return (
    <div className={'admin-track' + (dragging ? ' dragging' : '')}>
      <div
        className="admin-track-row"
        draggable={!editing}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          onDropAt(row.id, e.clientY > r.top + r.height / 2)
        }}
      >
        <span className="drag-handle" title="Drag to reorder" aria-hidden="true">⠿</span>
        <span className="at-num">{pos}</span>
        <span className="at-title">{row.title}{row.subtitle ? ` — ${row.subtitle}` : ''}</span>
        <span className="at-len">{fmtTime(row.duration_seconds)}</span>
        <span className="at-actions">
          <button className="btn outset" disabled={busy} onClick={editing ? () => setEditing(false) : start}>
            {editing ? 'Close' : 'Edit'}
          </button>
          <button className="btn outset" disabled={busy} onClick={() => onDelete(row)}>Delete</button>
        </span>
      </div>
      {editing && d && (
        <div className="track-editor">
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
              EP / folder <span className="muted">(optional — or just drag between groups)</span>
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
            <div className="editor-actions">
              <button className="btn outset" disabled={busy || !d.title.trim()} onClick={save}>
                Save changes
              </button>
              <button className="btn outset" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminConsole({ email }) {
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [notes, setNotes] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [collection, setCollection] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // {kind, text}
  const [dragId, setDragId] = useState(null)

  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(true)

  const collections = [...new Set(
    rows.map((r) => (r.collection || '').trim()).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b))

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  // Same grouping the player uses: by `collection`, groups ordered by their
  // lowest sort_order (loose tracks last), tracks within a group ascending.
  const groups = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      const key = (r.collection || '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    })
    const mn = (arr) => Math.min(...arr.map((r) => r.sort_order ?? 0))
    const made = (arr) => arr.reduce((m, r) => (r.created_at < m ? r.created_at : m), '~')
    const entries = [...map.entries()].sort((a, b) => {
      if (!a[0]) return 1
      if (!b[0]) return -1
      return mn(a[1]) - mn(b[1]) || (made(a[1]) < made(b[1]) ? -1 : 1)
    })
    entries.forEach(([, arr]) => arr.sort((x, y) =>
      (x.sort_order ?? 0) - (y.sort_order ?? 0) ||
      (x.created_at < y.created_at ? -1 : 1)))
    return entries
  }, [rows])

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

    // Auto-number: next slot after the last track already in this collection;
    // a brand-new collection goes to the very end.
    const coll = collection.trim()
    const inColl = rows.filter((r) => (r.collection || '').trim() === coll)
    const nextOrder = inColl.length
      ? Math.max(...inColl.map((r) => r.sort_order ?? 0)) + 1
      : rows.length ? Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1 : 0

    setMsg({ kind: 'notice', text: 'Saving track…' })
    const ins = await tolerantWrite(
      (p) => supabase.from('tracks').insert(p),
      {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        notes: notes.trim() || null,
        lyrics: lyrics.trim() || null,
        collection: coll || null,
        storage_path: path,
        duration_seconds: duration,
        sort_order: nextOrder,
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
    setTitle(''); setSubtitle(''); setNotes(''); setLyrics('')
    if (fileRef.current) fileRef.current.value = ''
    refresh()
  }

  // Drag-drop reorder. `after` = dropped on the lower half of the target row.
  async function reorder(destGroup, targetId, after) {
    const srcId = dragId
    setDragId(null)
    if (!srcId || srcId === targetId) return

    const model = groups.map(([name, list]) => ({ name, ids: list.map((r) => r.id) }))
    model.forEach((g) => { g.ids = g.ids.filter((id) => id !== srcId) })
    let dg = model.find((g) => g.name === destGroup)
    if (!dg) { dg = { name: destGroup, ids: [] }; model.push(dg) }
    let at = targetId ? dg.ids.indexOf(targetId) : dg.ids.length
    if (at < 0) at = dg.ids.length
    if (after && targetId) at += 1
    dg.ids.splice(at, 0, srcId)

    // Renumber every group into its own 1000-wide band so group order is kept
    // and each collection stays a clean ascending run.
    const patches = []
    model.forEach((g, gi) => {
      g.ids.forEach((id, i) => {
        const cur = rowsById.get(id)
        if (!cur) return
        const nextSort = gi * 1000 + i
        const nextColl = g.name || null
        if (cur.sort_order !== nextSort || (cur.collection || '') !== (g.name || '')) {
          patches.push({ id, sort_order: nextSort, collection: nextColl })
        }
      })
    })
    if (!patches.length) return

    setBusy(true)
    const results = await Promise.all(patches.map((p) =>
      supabase.from('tracks').update({ sort_order: p.sort_order, collection: p.collection }).eq('id', p.id)))
    setBusy(false)
    const bad = results.find((r) => r.error)
    if (bad) setMsg({ kind: 'error', text: bad.error.message })
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
          EP / folder <span className="muted">(optional — pick one or type a new name; position is set automatically)</span>
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
        {msg && <div className={msg.kind}>{msg.text}</div>}
        <button className="btn outset" disabled={busy}>{busy ? 'Working…' : 'Upload track'}</button>
      </form>

      <div>
        <h3 style={{ marginBottom: 4 }}>Tracks in the vault</h3>
        <p className="muted" style={{ margin: '0 0 8px' }}>
          Drag <span aria-hidden="true">⠿</span> to reorder within a group or move a track to another group.
        </p>
        {loadingRows ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Nothing uploaded yet.</p>
        ) : (
          <div className="admin-groups">
            {groups.map(([name, list]) => (
              <div
                className="admin-group"
                key={name || '__loose'}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); reorder(name, null, false) }}
              >
                <div className="admin-group-head">
                  {name || 'Loose tracks'} <span className="muted">· {list.length}</span>
                </div>
                {list.map((r, i) => (
                  <AdminTrack
                    key={r.id}
                    row={r}
                    pos={i + 1}
                    busy={busy}
                    dragging={dragId === r.id}
                    onDragStart={() => setDragId(r.id)}
                    onDragEnd={() => setDragId(null)}
                    onDropAt={(targetId, after) => reorder(name, targetId, after)}
                    onSave={onSave}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
