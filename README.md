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

A confirmed local user, a `user_profile` row (created by the `handle_new_user` trigger), and a session that can open `/dashboard`, `/profile`, and `/library`. Next: [How to upload a reference](#how-to-upload-a-reference), [How to save a Grok API key](#how-to-save-a-grok-api-key), [How to reset your password](#how-to-reset-your-password), or the [reference](#reference).

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

## How to upload a reference

You will store a PDF, DOCX, or TXT as a reference. It counts toward a 500-file cap for your account. After upload, `upload_processor` chunks the text and stores 384-d hash embeddings (`hash-384`). MiniLM is still TARGET.

### Prerequisites

- Confirmed session on [http://127.0.0.1:5173/dashboard](http://127.0.0.1:5173/dashboard)
- Local Storage healthy (`docker ps` shows `supabase_storage_arpw` up). If Storage is stopped, the UI shows `Upload failed: name resolution failed` and no row is inserted.

### Steps

1. Under **Reference Documents**, click the drop zone or drag files. The line `N stored` is the current count.
2. Use `.pdf`, `.docx`, or `.txt` only. Each file must be larger than 0 bytes and at most 10 MB. `.doc` is rejected before upload.
3. Wait until the progress row says Completed. The list under the zone should show the file name, size, and date.
4. **Example Papers** uses the same types and picker, with a cap of 10 stored rows (client count + `examples_file_cap` trigger).

### Verification

- Drop zone: `Up to 500 reference documents (PDF, DOCX, TXT) · N stored` with N increased.
- List: filename in **Reference Documents**.
- REST `GET /rest/v1/references?select=file_name,file_size` as the signed-in user returns the row.
- A `.doc` insert fails check `references_file_name_ext`.
- A 501st reference insert fails with `Reference cap of 500 files reached`.
- An 11th example insert fails with `Example cap of 10 files reached`.

Constraints and object key: [Reference: uploads](#upload-constraints-srccomponentsuploadzonetsx). Why the cap is on the table: [Why the reference cap is on the table](#why-the-reference-cap-is-on-the-table).

### Troubleshooting

| What you see | What to do |
|---|---|
| Unsupported format / empty / too large | Use PDF, DOCX, or TXT; 1 byte through 10 MB. |
| File cap reached / “can add N more” | Delete a listed reference, then retry. The cap includes rows already stored, not only this drop. |
| `name resolution failed` | Storage container is down. Start the local stack with the installed `supabase` CLI, not `npx supabase`. |
| Banner “Indexing may still fail” | Storage/ingest error. TXT/DOCX/PDF should index as `hash-384` chunks; check Edge logs. |

## How to list and delete a file

The dashboard table shows each stored file’s name, size, upload time, and whether vectors exist.

### Steps

1. Open `/dashboard`. Under **Reference Documents** or **Example Papers**, read the table (name, size, date, Index).
2. Index is `Indexed (N chunks)` after ingest, or `Stored (not indexed)` if Edge did not write vectors.
3. Click **Delete**, confirm. The app deletes vector rows, the metadata row, then the Storage object `{fileId}_{originalName}`.

### Verification

The row disappears. REST `GET /rest/v1/references?file_id=eq.<id>` is empty. Vector rows for that `file_id` are gone. `N stored` on the drop zone drops by one after refresh.

## How to generate a paper

You cannot yet. The dashboard form is wired; the generate handler is a stub.

### Steps

1. Enter a research prompt (required; empty prompt alerts “Please enter a research prompt”).
2. Toggle sections (Abstract through References). Pick paper type, citation style, output format.
3. Click **Generate Paper**.

### Verification

After about 2 seconds you get: `Paper generation feature will be implemented in the next phase` (`DashboardPage.tsx` `handleGenerate`). Nothing is written to `user_papers`.

When that changes, the intended pipeline is in [`.docs/TECHNICAL_SPECIFICATION.md`](.docs/TECHNICAL_SPECIFICATION.md) §7.

## How to save a Grok API key

You will store a key on the server so a future generation worker can call xAI. The browser will not be able to read the secret back.

### Prerequisites

A confirmed session. Open [http://127.0.0.1:5173/profile](http://127.0.0.1:5173/profile).

### Steps

1. Under **Grok API Key**, paste a key at least 10 characters. The field is empty even if a key is already saved.
2. Click **Save Changes**.
3. The page should say `A key is saved on the server (ends in …)`. The input clears.
4. To replace, paste a new key and save again. To delete, click **Remove saved key**.

Full name still saves through `user_profile`. The key does not. Leave the key field blank to keep the stored secret.

### Verification

The status line shows last4. `GET /rest/v1/user_profile?select=*` for your user has no `grok_api_key` column. `GET /rest/v1/user_grok_keys` returns permission denied. `POST /rest/v1/rpc/grok_api_key_status` returns `{"set": true, "last4": "…"}`.

### Troubleshooting

| What you see | What to do |
|---|---|
| “API key appears to be too short” | Client and RPC both require length ≥ 10 after trim. |
| “No key saved” after save | You are not confirmed, or the migration `20260907000000_grok_key_storage.sql` is not applied. |
| REST still returns `grok_api_key` on the profile | Old schema. Run the migration and `NOTIFY pgrst, 'reload schema';`. |

RPC signatures: [Reference: Grok key](#grok-key-rpcs). Why it is not on the profile: [Why the Grok key is not on the profile](#why-the-grok-key-is-not-on-the-profile).

## How to use the library and profile

**Library (`/library`):** lists `user_papers` for the current user, grouped by title. Empty until generation saves rows. View works if content exists. Delete hits the table after a confirm dialog. Regenerate and Export are no-ops. `referenceCount` is hardcoded `0`.

**Profile (`/profile`):** change **Full Name** (required, at least 2 characters). Email is read-only. Grok key: [How to save a Grok API key](#how-to-save-a-grok-api-key).

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

Commands: `npm run dev` (Vite), `npm run build` (`tsc && vite build`), `npm run preview`, `npm run lint`, `npm test` (Vitest: upload/auth validators in `src/lib/`).

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
| Profile name | `user_profile` update | After a confirmed session, `ensureUserProfile` inserts if the trigger missed (`23505` ignored). Never writes a Grok key. |
| Save Grok key | `rpc set_grok_api_key` | Encrypted row; returns `{ set, last4 }`. |
| Grok key status | `rpc grok_api_key_status` | `{ set, last4 }` only. |
| Remove Grok key | `rpc clear_grok_api_key` | Deletes the row. |

Client validation (`Login.tsx` / `ResetPassword.tsx`): email required and `^[^\s@]+@[^\s@]+\.[^\s@]+$`; password min 6; sign up requires full name and matching confirm password.

### Local Auth config (`supabase/config.toml`)

- `site_url = "http://127.0.0.1:5173"`
- Redirect allow-list: `/`, `/login`, `/reset-password`, `/verify-email` on `127.0.0.1` and `localhost`
- `[auth] enable_signup = true`, `minimum_password_length = 6`
- `[auth.email] enable_confirmations = true`, `max_frequency = "1s"`, `otp_length = 6`, `otp_expiry = 3600`
- `[auth.rate_limit] email_sent = 30`

### Grok key RPCs

Source: `supabase/migrations/20260907000000_grok_key_storage.sql`. Client wrappers: `setGrokApiKey` / `clearGrokApiKey` in `src/hooks/useAuth.tsx`. UI: `src/components/Profile.tsx`.

| RPC | Who | Args | Returns |
|---|---|---|---|
| `set_grok_api_key` | `authenticated` | `api_key text` (trimmed, min length 10) | `{ set: true, last4: text }` |
| `clear_grok_api_key` | `authenticated` | none | `{ set: false, last4: null }` |
| `grok_api_key_status` | `authenticated` | none | `{ set: boolean, last4: text \| null }` |
| `read_grok_api_key` | `service_role` only | `for_user uuid` | plaintext `text` or null |

`auth.uid()` is required for the first three. `read_grok_api_key` raises `forbidden` unless `auth.role() = 'service_role'`.

Table `public.user_grok_keys`: `user_id` PK, `ciphertext bytea`, `last4 text`, `updated_at`. No grants to `anon` or `authenticated`. Encryption: `pgp_sym_encrypt` with a secret in `private.secrets` (`id = 'grok_key_enc'`). The SPA never `select`s this table.

Example (user JWT, not a real key):

```bash
curl -sS http://127.0.0.1:54321/rest/v1/rpc/set_grok_api_key \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"xai-your-key-here"}'
```

Generation workers should call `read_grok_api_key` with the service role key and the paper owner's `user_id`. Do not put the service role key in the SPA.

### Upload constraints (`src/components/UploadZone.tsx`)

Client (`UploadZone.tsx`, references zone `maxFiles={500}`):

| Rule | Value |
|---|---|
| Extensions | `.pdf`, `.docx`, `.txt` (not `.doc`) |
| Size | `0 < size <= 10485760` (10 MiB) |
| Cap | `count(*)` of `"references"` for `auth.uid()` plus this batch must be ≤ 500 |
| Bucket | `references` |
| Object key | `{uuid}_{originalFileName}` at bucket root |
| Metadata | insert `{ file_id, user_id, document_type: 'reference', file_name, file_size }` after Storage succeeds; Storage object is removed if insert fails |
| Ingest | `upload_processor` is invoked after insert; failure does not roll back the file |

Database (`supabase/migrations/20260907010000_reference_upload_cap.sql`):

| Rule | Value |
|---|---|
| `references_file_name_ext` | `file_name ~* '\.(pdf\|docx\|txt)$'` |
| `references_file_size_check` | `file_size > 0 AND file_size <= 10485760` (from init) |
| `references_file_cap` | `BEFORE INSERT`: if the user already has 500 rows, raise `Reference cap of 500 files reached` |

Examples (`maxFiles={EXAMPLE_FILE_CAP}` = 10): same client rules; DB `examples_file_name_ext` and `examples_file_cap` (10). Bucket `papers` exists and is unused by the SPA.

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

## Why the Grok key is not on the profile

`select * from user_profile` is what the SPA already does. A `grok_api_key` column on that row meant every profile load returned the secret, and the UI claiming encryption was false.

The key is now a separate table with no client grants, written only through `set_grok_api_key`, and decrypted only by `read_grok_api_key` for `service_role`. The profile shows last4 so you can tell a key is present.

**Trade-off:** last4 is a small leak if someone else sees the profile screen. The full key never crosses the wire after save. Encryption uses a DB-side secret in `private.secrets`; if that row is lost, stored keys cannot be decrypted (re-paste the key).

**Not chosen:** leaving the column and “not showing it in the form” (REST still returned it). **Not chosen:** client-side encryption (the SPA would still hold the wrapping key).

## Why the reference cap is on the table

A cap of “500 files in this picker batch” lets you upload 500, then 500 more. DOCS-1 is 500 **per user**. The only per-user list the app has is `"references"`: Storage keys are `{uuid}_{name}` at the bucket root, with no `user_id` in the path.

So upload writes the Storage object, then a metadata row. The picker counts existing rows before it starts. The trigger blocks a 501st insert if two tabs race. Ingest (`upload_processor`) runs after that and can fail without deleting the file; otherwise a broken Edge function would hide files you already paid to store.

**Trade-off:** a file can exist in the list with no vectors until DOCS-5 is fixed. Empty or `.doc` names never get a row (`CHECK` on `file_name`).

**Not chosen:** counting only the current `FileList` (the old bug). **Not chosen:** waiting for ingest before insert (the list and cap would stay empty while Edge is broken).

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
