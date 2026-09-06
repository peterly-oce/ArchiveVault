# ArchiveVault

A retro (Windows 9x flavoured) web player for an artist's **unreleased tracks**.
Vite + React front end, Supabase for data + audio storage, deployed to GitHub Pages.

- **Listening is public** — anyone with the link can play everything.
- **`/#/admin`** is auth-gated. Only a signed-in Supabase user can upload / delete tracks.

> Because GitHub Pages is fully public static hosting, treat anything published here as
> released. `robots` is set to `noindex`, which discourages search engines but does not
> hide the site. If you need real privacy, this stack isn't the right one.

---

## 1. Supabase setup (once)

1. Open the project → **SQL Editor** → paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   This creates the `tracks` table + policies and a public `tracks` storage bucket.
2. **Authentication → Users → Add user** — create the admin account (email + password).
   Set "Auto Confirm User" so no email step is needed.
3. **Authentication → Providers → Email** — you can turn *off* "Enable sign-ups" so no one
   else can register.
4. Copy **Project URL** and the **anon public** key from **Project Settings → API**.

## 2. Local development

```bash
npm install
cp .env.example .env      # then paste your anon key into .env
npm run dev
```

Open the printed URL. The player is at `/`, admin at `/#/admin`.

## 3. Deploy to GitHub Pages

1. Push this repo to `https://github.com/peterly-oce/ArchiveVault` (branch `main`).
2. **Settings → Pages → Build and deployment → Source** = **GitHub Actions**.
3. Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   and publishes to `https://peterly-oce.github.io/ArchiveVault/`.

Supabase config is read from [`.env.production`](.env.production), which is committed
on purpose. It holds **public values only** — the Supabase URL and the `anon` key. The
anon key is designed to ship in client code (it already appears in the built bundle) and
Row Level Security is what actually protects writes. **Never** put the `service_role` key
or the DB password in that file.

To point at a different Supabase project, edit `.env.production` and push — no GitHub
Actions variables or secrets are involved.

## 4. Adding music

Go to `https://peterly-oce.github.io/ArchiveVault/#/admin`, sign in, pick an audio file,
fill in the title (and optional subtitle / liner notes / sort order), upload. It appears
in the playlist immediately.

## Project layout

| Path | What |
|---|---|
| `src/pages/Player.jsx` | public player UI + audio engine |
| `src/pages/Admin.jsx` | login + upload / delete console |
| `src/lib/supabaseClient.js` | Supabase client + storage helpers |
| `src/styles/retro.css` | the Win9x skin |
| `supabase/schema.sql` | tables, RLS policies, storage bucket |
| `.github/workflows/deploy.yml` | build + Pages deploy |

## Notes / limitations

- If a Supabase project is **paused** (free tier, after inactivity) the site shows a load
  error until you resume it in the dashboard.
- Track duration is read in the browser at upload time; if that fails it's stored as null
  and shows `00:00` in the list (playback still works).
