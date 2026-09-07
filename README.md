# AI Research Paper Writer (ARPW)

A web app for a single researcher: upload your own papers, then (when generation ships) draft a literature-backed paper from that corpus. Today the running app is auth, an upload UI, a profile page, and a library shell. Paper generation, retrieval, quality checks, and export are not built.

## What works today

| You can | You cannot |
|---|---|
| Sign up, confirm email, sign in, sign out, reset password | Generate a paper (the button waits 2s then alerts “next phase”) |
| Open dashboard, profile, library after confirmation | Retrieve passages or cite uploaded files |
| Upload PDF/DOCX/TXT to Storage from the dashboard | Index those files into vectors (ingest Edge function is broken) |
| Edit your display name; save a Grok key the SPA cannot read back | Decrypt the Grok key in the browser |

Product intent, architecture, and the remaining gap list live in [`.docs/`](.docs/README.md). This README is the user-facing walkthrough and reference.

## Tutorial: get to the dashboard

You will start the local stack, create an account, confirm the email in the local mailbox, and land on the dashboard.

### What you'll need

- Docker Desktop running
- Node.js (this repo is Vite 5 + React 18)
- Supabase CLI installed as a binary (`which supabase`). Homebrew 2.39.x is what this project was last started with. Do not use `npx supabase`.

### Step 1: Install and start the database

```bash
npm install
cp .env.example .env
supabase start
```

`supabase start` prints `API URL` (`http://127.0.0.1:54321`), `anon key`, Studio (`:54323`), and Inbucket/Mailpit (`:54324`). Put the printed URL and anon key in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `.env.example` already has the local demo values; they only work against this local stack.

You should see healthy containers and the keys. If Storage comes up unhealthy, you likely used `npx supabase` (newer images). Stop, use `/opt/homebrew/bin/supabase start` (or your installed CLI), and if the volume is mixed, wipe the local `supabase_*_arpw` Docker volumes and start again.

### Step 2: Run the app

```bash
npm run dev
```

Open [http://127.0.0.1:5173/login](http://127.0.0.1:5173/login). You should see “Sign in to your account” with email, password, “Forgot your password?”, and “Don't have an account? Sign up”. Port 5173 is fixed (`vite.config.ts`, `strictPort: true`). Vite listens on all interfaces so confirmation links that use `127.0.0.1` work.

### Step 3: Sign up

1. Click **Don't have an account? Sign up**.
2. Full name, email, password (at least 6 characters), confirm password.
3. Click **Create Account**.

The app moves to `/verify-email` and says “Check your email”. You cannot open `/dashboard` yet. Visiting it sends you back to login.

### Step 4: Confirm the email

1. Open [http://127.0.0.1:54324](http://127.0.0.1:54324) (local mailbox; CLI still labels it Inbucket).
2. Open the message **Confirm Your Email**.
3. Click the confirm link (it goes through `http://127.0.0.1:54321/auth/v1/verify` then back to `/login`).

You should land on the dashboard: “Generate Research Paper”, Welcome with your full name, Sign Out.

If the link is expired, stay on `/verify-email` and click **Resend confirmation email**, then check the mailbox again.

### What you built

A confirmed local user, a `user_profile` row (created by the `handle_new_user` trigger), and a session that can open `/dashboard`, `/profile`, and `/library`. Next: [How to reset your password](#how-to-reset-your-password), [How to upload files](#how-to-upload-files), or the [reference](#reference).

## How to confirm your email

Use this if you already have an account and the app will not let you in.

### Prerequisites

Local stack running. Mail UI at [http://127.0.0.1:54324](http://127.0.0.1:54324).

### Steps

1. Sign in with the same email and password. If Auth returns `Email not confirmed`, the app sends you to `/verify-email`.
2. Click **Resend confirmation email** if you need a new message.
3. In the mailbox, open **Confirm Your Email** and follow the link.

### Verification

`/dashboard` loads and the header shows your name or email. Unconfirmed users hitting `/dashboard` are sent to `/login` or `/verify-email`.

### Troubleshooting

| What you see | What to do |
|---|---|
| No mail | Confirm `supabase start` printed Inbucket/Mailpit `:54324`. Check you signed up with that exact address. |
| `Email not confirmed` then `/verify-email` | Expected. Confirm, do not keep retrying sign-in. |
| Rate limit | Local Auth allows 30 auth emails per hour (`[auth.rate_limit] email_sent`). Wait or use a new address. |
| Confirm link opens but dashboard never appears | Use `http://127.0.0.1:5173`, not a different host. Redirect allow-list is `127.0.0.1` and `localhost` on port 5173. |

## How to reset your password

You will request a reset email, set a new password on `/reset-password`, and sign in with it.

### Prerequisites

A confirmed account. Local mailbox at `:54324`.

### Steps

1. Sign out if you are in the app.
2. Open [http://127.0.0.1:5173/forgot-password](http://127.0.0.1:5173/forgot-password) (or **Forgot your password?** on `/login`).
3. Enter the account email. Click **Send reset link**.
4. You should see: “If an account exists for … a reset link is on its way.”
5. In the mailbox, open **Reset Your Password** and follow the link (`type=recovery`, `redirect_to=.../reset-password`).
6. On **Choose a new password**, enter the same password twice (at least 6 characters). Click **Update password**.

### Verification

The app goes to `/dashboard`. Sign out, sign in with the new password. The old password must fail.

### Troubleshooting

| What you see | What to do |
|---|---|
| “This reset link is invalid or has expired” | Request a new link. Recovery tokens are one-shot. |
| Forgot-password form never shows success | You were still signed in; `/forgot-password` redirects confirmed users to `/dashboard`. Sign out first. |
| Update succeeds but you bounce back to reset | You still have a recovery session. Finish **Update password**; do not visit other app routes until it completes. |

## How to upload files

You will attach a PDF, DOCX, or TXT as a reference or example. The file is stored in Supabase Storage. Indexing into vectors is not working yet.

### Prerequisites

Confirmed session on `/dashboard`.

### Steps

1. On the dashboard, use **Reference Documents** (cap 500 in the picker batch) or **Example Papers** (cap 10 in the picker batch).
2. Drag a file or click the drop zone. Allowed extensions: `.pdf`, `.docx`, `.doc`, `.txt`. Max 10 MB each (`UploadZone.tsx`).
3. The client uploads to bucket `references` or `examples` as `{uuid}_{originalName}`, then invokes Edge Function `upload_processor`.

### Verification

The file appears in the list under the zone if Storage accepted it. A green “uploaded and processed” banner means the UI thinks ingest succeeded. Today ingest is still broken (wrong storage path parse, PDF/DOCX handling on Edge), so treat “processed” as untrusted until [`.docs/GAP_ANALYSIS.md`](.docs/GAP_ANALYSIS.md) marks DOCS-5 done.

### Troubleshooting

| What you see | What to do |
|---|---|
| File too large / unsupported format | Client check failed. Stay under 10 MB; use PDF, DOC, DOCX, or TXT. `.doc` is accepted in the UI and rejected later in the function. |
| Processing failed | Expected with the current `upload_processor`. The object may still sit in Storage. |
| Caps feel wrong | Caps are per FileList, not against existing rows (DOCS-7 missing). |

## How to generate a paper

You cannot yet. The dashboard form is wired; the generate handler is a stub.

### Steps

1. Enter a research prompt (required; empty prompt alerts “Please enter a research prompt”).
2. Toggle sections (Abstract through References). Pick paper type, citation style, output format.
3. Click **Generate Paper**.

### Verification

After about 2 seconds you get: `Paper generation feature will be implemented in the next phase` (`DashboardPage.tsx` `handleGenerate`). Nothing is written to `user_papers`.

When that changes, the intended pipeline is in [`.docs/TECHNICAL_SPECIFICATION.md`](.docs/TECHNICAL_SPECIFICATION.md) §7.

## How to use the library and profile

**Library (`/library`):** lists `user_papers` for the current user, grouped by title. Empty until generation saves rows. View works if content exists. Delete hits the table after a confirm dialog. Regenerate and Export are no-ops. `referenceCount` is hardcoded `0`.

**Profile (`/profile`):** change **Full Name** (required, at least 2 characters). Email is read-only. **Grok API Key** is written through `set_grok_api_key` and stored encrypted. The profile page only sees whether a key exists and its last four characters. Generation (when it ships) will read the key with `service_role`.

## Reference

### Ports and env

| What | Value |
|---|---|
| App | `http://127.0.0.1:5173` (`vite.config.ts`: port 5173, `strictPort`, `host: true`) |
| Supabase API | `http://127.0.0.1:54321` |
| Studio | `http://127.0.0.1:54323` |
| Mail (Mailpit/Inbucket) | `http://127.0.0.1:54324` |
| Postgres | Port `54322`; URL is printed by `supabase status` (local default user `postgres`) |
| `VITE_SUPABASE_URL` | API URL from `supabase status` |
| `VITE_SUPABASE_ANON_KEY` | anon key from `supabase status` |

Commands: `npm run dev` (Vite), `npm run build` (`tsc && vite build`), `npm run preview`, `npm run lint`. There is no `npm test`.

### Routes (`src/App.tsx`)

| Path | Screen | Gate |
|---|---|---|
| `/login` | Sign in / sign up | Public; confirmed users go to `/dashboard` |
| `/verify-email` | Check inbox / resend | Public; confirmed users go to `/dashboard` |
| `/forgot-password` | Request reset | Public; confirmed users go to `/dashboard` |
| `/reset-password` | Set new password | Public; needs recovery session or any session |
| `/dashboard` | Generate form + uploads | Confirmed, not in recovery |
| `/profile` | Name and Grok key | Same |
| `/library` | Saved papers | Same |
| `/` | Redirect to `/dashboard` | Same |
| `*` | Dashboard or login | Same |

App access: `user && email_confirmed_at && !isRecovery`. A missing `user_profile` row does not block the shell; the header falls back to email or `user_metadata.full_name`.

### Auth behavior (`src/hooks/useAuth.tsx`)

Wrapped by `AuthProvider` in `src/main.tsx`. One client: `src/supabaseClient.ts`, `storageKey: 'arpw-auth'`.

| Action | Call | Notes |
|---|---|---|
| Sign up | `supabase.auth.signUp` | `emailRedirectTo` = `{origin}/login`. `full_name` in user metadata. No client profile insert. Success with no session ⇒ `needsEmailConfirmation`. |
| Sign in | `signInWithPassword` | Unconfirmed → error and `/verify-email`. If `email_confirmed_at` is missing, the client signs out. |
| Sign out | `signOut` | Clears session and recovery flag. |
| Reset request | `resetPasswordForEmail` | `redirectTo` = `{origin}/reset-password`. |
| Set password | `updateUser({ password })` | Clears `isRecovery`, then UI goes to `/dashboard`. |
| Resend | `resend({ type: 'signup' })` | Same `emailRedirectTo` as sign up. |
| Profile | `user_profile` update | After a confirmed session, `ensureUserProfile` inserts if the trigger missed (`23505` ignored). |

Client validation (`Login.tsx` / `ResetPassword.tsx`): email required and `^[^\s@]+@[^\s@]+\.[^\s@]+$`; password min 6; sign up requires full name and matching confirm password.

### Local Auth config (`supabase/config.toml`)

- `site_url = "http://127.0.0.1:5173"`
- Redirect allow-list: `/`, `/login`, `/reset-password`, `/verify-email` on `127.0.0.1` and `localhost`
- `[auth] enable_signup = true`, `minimum_password_length = 6`
- `[auth.email] enable_confirmations = true`, `max_frequency = "1s"`, `otp_length = 6`, `otp_expiry = 3600`
- `[auth.rate_limit] email_sent = 30`

### Upload constraints (`src/components/UploadZone.tsx`)

- Extensions: `.pdf`, `.docx`, `.doc`, `.txt`
- Max size: 10 MiB
- Buckets: `references`, `examples` (also `papers` in the migration; unused by the SPA)
- Object key: `{uuid}_{originalFileName}` at the bucket root

### npm scripts

```bash
npm run dev      # Vite
npm run build    # tsc && vite build
npm run preview  # vite preview
npm run lint     # eslint . --ext ts,tsx
```

## Why email confirmation

Without confirmation, anyone can sign up with an address they do not own and immediately upload into Storage. The app therefore requires `email_confirmed_at` before `/dashboard`. Signup is still open: no invite list.

The profile row is created by SQL trigger `handle_new_user` on `auth.users`. The old login gate `user && userProfile` trapped people when that insert raced or failed. Access is now the confirmed Auth user; the profile is filled in after confirm.

Recovery sessions (`PASSWORD_RECOVERY`) are kept on `/reset-password` so a reset link cannot be used as a normal login until the password is changed.

**Trade-off:** local development needs the mailbox at `:54324`. Confirmations are on in `config.toml`, so turning them off for convenience would ship a different security model than production.

**Not chosen:** keeping confirmations off locally (faster demos, unverified users in the app). **Not chosen:** blocking on `user_profile` existence (that was the signup bug).

## Project structure

```
src/
├── components/            # Screens the router actually mounts
│   ├── Login.tsx
│   ├── VerifyEmail.tsx
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   ├── Layout.tsx
│   ├── Profile.tsx
│   ├── UploadZone.tsx
│   └── DocumentList.tsx
├── hooks/
│   └── useAuth.tsx        # AuthProvider
├── pages/
│   ├── DashboardPage.tsx
│   └── LibraryPage.tsx
├── types.ts
├── supabaseClient.ts
├── App.tsx
├── main.tsx
└── index.css
```

`pages/LoginPage.tsx` and `pages/ProfilePage.tsx` exist but are unused. Schema: `supabase/migrations/20260906133100_init.sql`.

## Specs

Intent and remaining work (not this walkthrough):

- **Index**: [`.docs/README.md`](.docs/README.md)
- **PRD**: [`.docs/PRODUCT_REQUIREMENTS.md`](.docs/PRODUCT_REQUIREMENTS.md)
- **Tech spec**: [`.docs/TECHNICAL_SPECIFICATION.md`](.docs/TECHNICAL_SPECIFICATION.md)
- **Gap analysis**: [`.docs/GAP_ANALYSIS.md`](.docs/GAP_ANALYSIS.md)

Superseded drafts: [`.docs/legacy/`](.docs/legacy/).

## License

This project is for personal/educational use.
