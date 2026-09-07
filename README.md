# AI Research Paper Writer (ARPW)

A web app for a single researcher: upload your own papers, then draft a literature-backed paper from that corpus. Today you can retrieve passages, pin them to a paper, ask grounded questions of the corpus (thread saved as notes), generate a section-by-section draft that prefers pins (Grok key required), and save it to the library. Quality-check polish and export are not built.

## What works today

| You can | You cannot |
|---|---|
| Sign up, confirm email, sign in, sign out, reset password | Decrypt the Grok key in the browser |
| Open dashboard, paper generation, profile, library after confirmation | Outline or Word export |
| Upload PDF/DOCX/TXT when local Storage is up | Count on ingest E2E while Storage is down; MiniLM is still TARGET |
| Retrieve passages, pin/unpin them, interrogate the corpus, generate a draft, and save it to the library | Live Grok E2E in `npm test` (unit suite has no network) |
| Edit your display name; save a Grok key the SPA cannot read back | Storage upload, ingest Edge E2E, or live Grok if those services are down |

Product intent, architecture, and the remaining gap list live in [`.docs/`](.docs/README.md). This README is the user-facing walkthrough and reference.

### In this README

| Kind | Where |
|---|---|
| Tutorial | [Get to the dashboard](#tutorial-get-to-the-dashboard), [Run the unit tests](#tutorial-run-the-unit-tests) |
| How-to | [Confirm email](#how-to-confirm-your-email), [Reset password](#how-to-reset-your-password), [Upload](#how-to-upload-a-reference), [List and delete](#how-to-list-and-delete-a-file), [Generate](#how-to-generate-a-paper), [Interrogate](#how-to-interrogate-the-corpus), [Grok key](#how-to-save-a-grok-api-key), [Library and profile](#how-to-use-the-library-and-profile), [Run tests](#how-to-run-tests), [Add a test](#how-to-add-a-test) |
| Reference | [Ports and env](#ports-and-env), [Routes](#routes-srcapptsx), [Auth](#auth-behavior-srchooksuseauthts), [Grok RPCs](#grok-key-rpcs), [Uploads](#upload-constraints-srccomponentsuploadzonetsx), [Tests](#tests), [npm scripts](#npm-scripts) |
| Explanation | [Why email confirmation](#why-email-confirmation), [Why the Grok key is not on the profile](#why-the-grok-key-is-not-on-the-profile), [Why the reference cap is on the table](#why-the-reference-cap-is-on-the-table), [Why two test suites](#why-two-test-suites) |
| Specs | [`.docs/`](.docs/README.md) |

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

You should land on the Dashboard: counts for papers and uploads, Welcome with your full name, Sign Out. Paper generation is a separate tab.

If the link is expired, stay on `/verify-email` and click **Resend confirmation email**, then check the mailbox again.

### What you built

A confirmed local user, a `user_profile` row (created by the `handle_new_user` trigger), and a session that can open `/dashboard`, `/generate`, `/profile`, and `/library`. Next: [Run the unit tests](#tutorial-run-the-unit-tests), [How to upload a reference](#how-to-upload-a-reference), [How to save a Grok API key](#how-to-save-a-grok-api-key), [How to reset your password](#how-to-reset-your-password), or the [reference](#reference).

## Tutorial: run the unit tests

You will run the fast helper tests and see them pass. No Docker. This is the suite `npm test` always runs.

### What you'll need

- Node.js and `npm install` already done (same as [Step 1](#step-1-install-and-start-the-database) of the dashboard tutorial). You do **not** need `supabase start` for this tutorial.

### Step 1: Run the unit suite

From the repo root:

```bash
npm test
```

That is `vitest run` with `vite.config.ts`: `src/**/*.test.ts`, excluding `*.integration.test.ts`.

### Step 2: Read the result

You should see twenty-one files pass, currently 96 tests:

```
Test Files  21 passed (21)
      Tests  96 passed (96)
```

If a file under `src/lib/` fails, the helper that the upload UI or ingest path calls is wrong. Fix that before touching the live API.

### Step 3 (optional): Run integration against local Auth

If Docker and `supabase start` are already up from the dashboard tutorial:

```bash
npm run test:integration
```

You should see twelve files pass, currently 36 tests, when local API, Storage, and Edge functions are up. Live Storage object isolation and fixture-PDF ingest skip if those services are down. Details: [How to run tests](#how-to-run-tests). Why this is a second command: [Why two test suites](#why-two-test-suites).

### What you built

Proof that the unit helpers for upload, ingest, pins, interrogation, retrieval, and generate allow-list behave as `src/lib/*.test.ts` describe. Next: [How to run tests](#how-to-run-tests) or [How to add a test](#how-to-add-a-test).

## How to confirm your email

Use this if you already have an account and the app will not let you in.

### Prerequisites

Local stack running. Mail UI at [http://127.0.0.1:54324](http://127.0.0.1:54324).

### Steps

1. Sign in with the same email and password. If Auth returns `Email not confirmed`, the app sends you to `/verify-email`.
2. Click **Resend confirmation email** if you need a new message.
3. In the mailbox, open **Confirm Your Email** and follow the link.

### Verification

`/dashboard` loads and the header shows your name or email. Unconfirmed users hitting `/dashboard` or `/generate` are sent to `/login` or `/verify-email`.

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

You will store a PDF, DOCX, or TXT. Literature and original research share a 500-file cap. After upload, `upload_processor` chunks the text and stores 384-d hash embeddings (`hash-384`). MiniLM is still TARGET.

### Prerequisites

- Confirmed session. Open [http://127.0.0.1:5173/generate/upload](http://127.0.0.1:5173/generate/upload).
- Local Storage healthy (`docker ps` shows `supabase_storage_arpw` up). If Storage is stopped, the UI shows `Upload failed: name resolution failed` and no row is inserted.

### Steps

1. On the **Upload** tab, use **Literature** for published papers you will cite, or **Original research** for your own work on this paper’s topic. `N stored` is the combined reference count (cap 500).
2. Use `.pdf`, `.docx`, or `.txt` only. Each file must be larger than 0 bytes and at most 10 MB. `.doc` is rejected before upload.
3. Wait until the progress row says Completed. The list under that section should show the file.
4. **Example papers** (voice/style only) use the same types, cap 10.

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

The Upload tab lists literature, original research, and example papers (name, size, date, index). Literature and original research share the reference cap. Role can be changed: Literature vs Original research (your work on this paper’s topic).

### Steps

1. Open `/generate/upload`.
2. Index is `Indexed (N chunks)` after ingest, or `Stored (not indexed)` if Edge did not write vectors.
3. Upload published sources under **Literature**. Upload your own research on this paper’s topic under **Original research**. Upload voice/style files under **Example papers**.
4. Click **Delete**, confirm. The app deletes vector rows, the metadata row, then the Storage object `{user_id}/{file_id}`.

### Verification

The row disappears. REST `GET /rest/v1/references?file_id=eq.<id>` is empty. Vector rows for that `file_id` are gone. `N stored` on the drop zone drops by one after refresh.

## How to generate a paper

Section-by-section draft from your research prompt, frozen type×section templates, and retrieved chunks. Citations must use retrieved `[S#]` ids; unknown ids are dropped. A successful generate saves the draft to the library.

### Prerequisites

A confirmed session, a paper started from `/dashboard`, indexed files on the Upload tab, and a Grok API key on `/profile`. The browser never reads the key back.

### Steps

1. On `/dashboard`, start a new paper or click Continue on an existing one. Then open the Prompt tab (`/generate?paper=…`).
2. Enter a research prompt (required; saved on the paper). Toggle sections. Pick paper type, citation style, output format.
3. Click **Query sources**. Literature and original research list as evidence; example papers as style only. Pin a chunk to this paper (Unpin from the pinned list). Example papers cannot be pinned. Pinned passages are listed first.
4. Click **Generate Paper**. The Edge function retrieves pins first, then the same role-filtered search, calls Grok, strips unknown `[S#]` citations, flags uncited sentences, and writes `user_papers` plus `paper_references`. The draft, cited files, citation check, and uncited sentences show on the right.
5. If you have not saved a key, the page shows “Save a Grok API key on Profile before generating.” with a link to `/profile`.
6. Open `/library`. The paper is listed as completed. View shows the markdown. Continue restores the prompt. Sources is the number of cited files.

Files live on the **Upload** tab (`/generate/upload`). Interrogate the corpus on **Interrogate** (`/generate/interrogate?paper=…`).

### Verification

Indexed references + a prompt that overlaps their text should list passages with a score. Methods on an Empirical Study prefers `primary` files, then literature. A literature-review paper uses literature only. Empty prompt shows “Enter a research prompt”. A generate with no key must not call xAI. After a successful generate, `/library` shows the paper; Continue reopens Prompt with the saved research prompt. Pipeline: [`.docs/TECHNICAL_SPECIFICATION.md`](.docs/TECHNICAL_SPECIFICATION.md) §7.

### Troubleshooting

| What you see | What to do |
|---|---|
| “Save a Grok API key on Profile before generating.” | Save a key on `/profile`. The SPA never reads it back. |
| Generate 404 / function not found | A `supabase start` from before `generate_paper` existed will not register it. Run `supabase functions serve` (installed CLI). |
| Generate 503 BOOT_ERROR | Deno imports in `supabase/functions/_shared` must use `.ts` extensions. |
| Interrogate 404 / function not found | `interrogate_corpus` is a new Edge function. Run `supabase functions serve` (installed CLI) so it registers next to `generate_paper`. |
| Upload/index 502, logs say lock file hash mismatch | Delete `supabase/functions/**/deno.lock` (gitignored). `deno.json` sets `"lock": false` so esm.sh republishes do not break ingest. |

## How to interrogate the corpus

Ask a question of your literature and/or original research. The worker retrieves chunks, Grok answers using only those `[S#]` ids, and unknown ids are dropped. Turns are saved as notes on the paper. They are not evidence.

### Prerequisites

A confirmed session, a paper from `/dashboard`, indexed literature or original research, and a Grok API key on `/profile`.

### Steps

1. Open the Interrogate tab (`/generate/interrogate?paper=…`).
2. Choose sources: both, literature only, or original research only. Example papers are never searched.
3. Enter a question and click **Ask**.
4. Read the thread. Pin a passage (optional target section, or any section). Unpin from this list or from the Prompt tab. Reload the tab: the thread is still there.

### Verification

A question that overlaps indexed text should list passages with `[S#]` labels. Pin, then open Prompt: the pin is listed. Reload Interrogate: the Q&A remains. A missing key shows the same Profile error as generate. Example-paper-only corpora should match nothing. Chat notes must not appear in Query sources.

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

**Library (`/library`):** lists `user_papers` for the current user, grouped by title. After generate, the row is `completed` and View shows the markdown. Continue opens Paper generation with the saved prompt. Sources is the `paper_references` count. Delete hits the table after a confirm dialog. Export is not built.

**Profile (`/profile`):** change **Full Name** (required, at least 2 characters). Email is read-only. Grok key: [How to save a Grok API key](#how-to-save-a-grok-api-key).

## How to run tests

You will run the unit suite, then (if local Supabase is up) the Auth/REST/RLS integration suite.

### Prerequisites

- Unit: `npm install`. No Docker.
- Integration: local Supabase running (`supabase start` with the installed CLI, not `npx`). Storage may be down. `.env` may copy `.env.example`; integration falls back to the local demo keys when the URL is `127.0.0.1` / `localhost`.

### Steps

1. Run the unit suite:

   ```bash
   npm test
   ```

   Watch mode: `npm run test:watch`.

2. Confirm local API health (integration only):

   ```bash
   supabase status
   ```

   You need API `:54321`. Storage and Edge functions should be up for the live upload/ingest/generate/interrogate cases; those tests skip if they are down.

3. Run integration:

   ```bash
   npm run test:integration
   ```

### Verification

- Unit: `Test Files  21 passed (21)` and `Tests  96 passed (96)` (run 2026-09-07).
- Integration: `Test Files  12 passed (12)` and `Tests  36 passed (36)` against local API with Storage and Edge functions up (run 2026-09-07). Storage object isolation and fixture-PDF ingest skip if Storage or `upload_processor` is down. Generate/interrogate missing-key cases skip if those functions are down.
- `npm test` must not execute `src/integration/*.integration.test.ts` (excluded in `vite.config.ts`).
- Neither suite calls xAI. Missing-Grok-key paths are covered; a live completion is not.

### Troubleshooting

| What you see | What to do |
|---|---|
| `Local Supabase is not running at http://127.0.0.1:54321` | Start with the installed `supabase` binary. Do not use `npx supabase`. |
| Sign-in errors about email not confirmed | Expected in the app; the suite confirms users with the service role. Do not set `enable_confirmations = false` to make tests pass. |
| `SUPABASE_SERVICE_ROLE_KEY is required` | You pointed `VITE_SUPABASE_URL` at a non-local project. Set the service role in `.env` or use the local URL. |
| Integration tries to upload to Storage | Live object RLS and ingest skip if Storage or `upload_processor` is down. Auth/REST/pins/notes still run. |
| `npm test` picks up `*.integration.test.ts` | Check `vite.config.ts` `test.exclude`. |

File lists, env, and helpers: [Reference: tests](#tests). Why the split: [Why two test suites](#why-two-test-suites).

## How to add a test

You will add either a fast unit test (no Docker) or a live Auth/REST test.

### Prerequisites

The same as [How to run tests](#how-to-run-tests). Name tests `it('should …')`.

### Steps

1. **Unit** (pure helpers): create or edit `src/lib/<name>.test.ts`. Import from the helper next to it (or from `supabase/functions/upload_processor/ingest.ts` for ingest). Run `npm test`.

2. **Integration** (live API): create `src/integration/<name>.integration.test.ts`. Call `assertSupabaseUp` in `beforeAll`. Create users with `createConfirmedUser` from `src/integration/supabaseTest.ts`, and `deleteUser` in `finally`. Run `npm run test:integration`.

3. Do not put live `fetch` / Supabase calls in `*.test.ts`. `vite.config.ts` treats those as unit tests. Do not add Storage upload or `upload_processor` invokes until Storage is healthy; a green ingest E2E while Storage is down would be a lie.

### Verification

- New unit file appears in `npm test`.
- New `*.integration.test.ts` appears only in `npm run test:integration`.
- Failed cases assert on the real error text (`Email not confirmed`, `Reference cap of 500`, `Example cap of 10`, `too short`, check constraint names).

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
| `SUPABASE_SERVICE_ROLE_KEY` | Local demo service_role (`.env.example`). SPA must not use this. Integration tests use it to confirm users. |

Commands: `npm run dev` (Vite), `npm run build` (`tsc && vite build`), `npm run preview`, `npm run lint`, `npm test` (unit), `npm run test:integration` (local Auth/REST/Postgres; Storage/ingest not included while Storage is down).

### Routes (`src/App.tsx`)

| Path | Screen | Gate |
|---|---|---|
| `/login` | Sign in / sign up | Public; confirmed users go to `/dashboard` |
| `/verify-email` | Check inbox / resend | Public; confirmed users go to `/dashboard` |
| `/forgot-password` | Request reset | Public; confirmed users go to `/dashboard` |
| `/reset-password` | Set new password | Public; needs recovery session or any session |
| `/dashboard` | Home: counts, new paper, continue existing | Confirmed, not in recovery |
| `/generate` | Paper generation · Prompt | Same |
| `/generate/upload` | Paper generation · Upload (literature, original research, examples) | Same |
| `/generate/interrogate` | Paper generation · Interrogate | Same |
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
| Object key | `{user_id}/{file_id}` (from `auth.uid()` and the new file id; original name is only on the metadata row) |
| Metadata | insert `{ file_id, user_id, document_type: 'reference', file_name, file_size }` after Storage succeeds; Storage object is removed if insert fails |
| Ingest | `upload_processor` is invoked after insert; it downloads `{auth.uid()}/{fileId}` and ignores a client `storagePath`. Failure does not roll back the file |

Database (`supabase/migrations/20260907010000_reference_upload_cap.sql`):

| Rule | Value |
|---|---|
| `references_file_name_ext` | `file_name ~* '\.(pdf\|docx\|txt)$'` |
| `references_file_size_check` | `file_size > 0 AND file_size <= 10485760` (from init) |
| `references_file_cap` | `BEFORE INSERT`: if the user already has 500 rows, raise `Reference cap of 500 files reached` |

Examples (`maxFiles={EXAMPLE_FILE_CAP}` = 10): same client rules; DB `examples_file_name_ext` and `examples_file_cap` (10). Bucket `papers` exists and is unused by the SPA.

### Tests

Vitest 2 (`package.json`). Two configs so `npm test` never talks to the network.

| Command | Config | Include | Environment |
|---|---|---|---|
| `npm test` / `npm run test:watch` | `vite.config.ts` `test` | `src/**/*.test.ts` | node, no Docker |
| `npm run test:integration` | `vitest.integration.config.ts` | `src/**/*.integration.test.ts` | node, live `VITE_SUPABASE_URL` (default `http://127.0.0.1:54321`), timeout 30s, `fileParallelism: false` |

`vitest.integration.config.ts` loads `.env` via Vite `loadEnv('test', …, '')`.

#### Unit files (`src/lib/*.test.ts`)

| File | What it locks |
|---|---|
| `validateFile.test.ts` | PDF/DOCX/TXT, empty, >10 MB, `.doc`, no extension |
| `fileCap.test.ts` | `remainingSlots` / `uploadCapError`; example cap 10 |
| `uploadProgress.test.ts` | Per-file progress rows and status labels (DOCS-3) |
| `documentStore.test.ts` | Table/bucket/vector table map, `{user_id}/{file_id}` key, index labels |
| `formatFile.test.ts` | Size, date, icon |
| `validateAuth.test.ts` | Email, password, confirm, full name, login fields, Grok key length |
| `ingest.test.ts` | `storageTarget` `{user_id}/{file_id}`, `userOwnsStorageKey`, `validateIngestFile`, DOCX XML, chunking, hash-384 |
| `nfr7Fixture.test.ts` | Synthetic fixture PDF (no PII): valid size, probe token in bytes, pdf-parse extract, chunk + hash-384 |
| `sourceRole.test.ts` | `literature` / `primary` parse and labels (DOCS-8) |
| `generationTemplates.test.ts` | Paper type × section frozen templates; Empirical Methods ≠ Lit Review Introduction |
| `retrievePassages.test.ts` | Primary-then-literature attempts; pin-first merge; example pins dropped; Abstract/Intro unions primary |
| `pins.test.ts` | Target section parse; `Interrogate` rejected; attach file/chunk; lookup by `vector_id` |
| `interrogateCorpus.test.ts` | Paper + question required; unknown `[S#]` stripped; no Grok call when nothing matched |
| `interrogationNotes.test.ts` | user/assistant roles; stored passages are notes, not `reference_vectors` |
| `papers.test.ts` | Draft title, default sections, paper id parse, source count |
| `attribution.test.ts` | Sentence → chunk via `[S#]` or quote span; uncited flag (QUAL-1) |
| `citations.test.ts` | `[S#]` numbering; drop unknown ids (NFR-7) |
| `citationCheck.test.ts` | QUAL-2: `[S#]` in retrieved set and cited files in `paper_references` |
| `generatePaper.test.ts` | Section loop strips `[S99]`; ignores client `sourceIds` / `systemPrompt` |
| `grokComplete.test.ts` | Chat completions POST; non-OK does not echo the body |
| `generatePaperClient.test.ts` | Missing-key JSON wins over the generic invoke error |

#### Integration files (`src/integration/*.integration.test.ts`)

Helper: `src/integration/supabaseTest.ts` (`assertSupabaseUp`, `storageIsUp`, `ingestFunctionIsUp`, `generateFunctionIsUp`, `interrogateFunctionIsUp`, `createConfirmedUser`, `deleteUser`, `anonClient` / `adminClient` / `userClient`). Local demo JWT fallbacks match `supabase start`. Password for created users: `test-pass-123`.

| File | What it locks |
|---|---|
| `auth.integration.test.ts` | Unconfirmed sign-in fails; confirm + profile (no `grok_api_key` column); wrong password; full-name update; reset-email request; user cannot call `read_grok_api_key` |
| `grokKey.integration.test.ts` | set/status/last4; table 403; admin decrypt; clear; key &lt; 10 chars; unauthenticated RPCs |
| `documents.integration.test.ts` | Reference and example insert/list/delete + vectors; `.doc` CHECK; `.pdf`/`.docx` OK; empty/oversized/`document_type` CHECK; example cap 10; reference cap 500; `source_role` default/update/CHECK |
| `rls.integration.test.ts` | Other user cannot see references/examples/profile/papers; cannot insert as someone else; cannot read/write others’ vectors; cannot rename others; cannot change `source_role` |
| `storage.integration.test.ts` | Postgres has prefix Storage policies. Live upload/download/delete isolation skips if Storage is down |
| `ingest.integration.test.ts` | Fixture PDF → `upload_processor` → `hash-384` chunks containing `nfr7probe`. Skips if Storage or the Edge function is down |
| `retrieval.integration.test.ts` | `nfr7probe` query hits the fixture chunk; RLS; `source_role` filter; empirical Methods prefers primary; pinned literature chunk leads Methods retrieval |
| `papers.integration.test.ts` | Create draft, list, RLS hide from other user, update title; save content and owned `paper_references` only |
| `generate.integration.test.ts` | `generate_paper` 401 without JWT; missing Grok key; extra `sourceIds` ignored. Skips if the function is down |
| `pins.integration.test.ts` | Pin/list/unpin own chunk; unscoped target; cannot see or pin another user’s chunk; example vectors and `Appendix` rejected |
| `interrogate.integration.test.ts` | `interrogate_corpus` 401 without JWT; missing Grok key. Skips if the function is down |
| `interrogationNotes.integration.test.ts` | Save/reload thread; other user cannot see turns; chat text is not returned by `match_reference_chunks` |

**Not in either suite:** live Grok completion (needs a real xAI key). Missing-key paths for generate and interrogate are covered when those Edge functions are up.

How-to: [How to run tests](#how-to-run-tests). Why: [Why two test suites](#why-two-test-suites).

### npm scripts

```bash
npm run dev      # Vite
npm run build    # tsc && vite build
npm run preview  # vite preview
npm run lint              # eslint . --ext ts,tsx
npm test                  # unit (src/lib/*.test.ts)
npm run test:watch        # unit, watch mode
npm run test:integration  # local Supabase Auth/REST (needs supabase start)
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

A cap of “500 files in this picker batch” lets you upload 500, then 500 more. DOCS-1 is 500 **per user**. The product list is the `"references"` table, not a Storage listing.

So upload writes `{user_id}/{file_id}` in Storage, then a metadata row (original `file_name` for display). The picker counts existing rows before it starts. The trigger blocks a 501st insert if two tabs race. Ingest (`upload_processor`) runs after that and can fail without deleting the file; otherwise a broken Edge function would hide files you already paid to store.

**Trade-off:** a file can exist in the list with no vectors until DOCS-5 is fixed. Empty or `.doc` names never get a row (`CHECK` on `file_name`).

**Not chosen:** counting only the current `FileList` (the old bug). **Not chosen:** waiting for ingest before insert (the list and cap would stay empty while Edge is broken).

## Why two test suites

`npm test` has to stay a few hundred milliseconds with no Docker. Upload validators, caps, and `hashEmbedding` are pure functions; they belong there.

RLS (row-level security: Postgres only returns that user's rows), email confirmation, Grok RPCs, and table CHECKs are Postgres + GoTrue behavior. Mocking them would not catch a missing `GRANT` or a trigger that never fired. Those tests hit the local API.

Confirmations are on (`enable_confirmations = true`). A real user confirms via Mailpit. Tests cannot click the mailbox, so `createConfirmedUser` signs up, then `auth.admin.updateUserById({ email_confirm: true })` with the service role, then signs in. That is the same gate as the app, without a human inbox.

Storage is a third system. `supabase_storage_arpw` is often `Exited` if image tags mixed (`npx` vs Homebrew CLI). An ingest E2E that skipped Storage or stubbed the object would report green while the dashboard still shows `name resolution failed`. Those tests wait until Storage stays up.

**Trade-off:** integration needs Docker and writes throwaway `it-*@example.com` users (deleted in `finally`). The 500-file cap test inserts 499 rows as admin, then the 500th and 501st as the user.

**Not chosen:** one Vitest include of `src/**/*.test.ts` (integration would run on every `npm test` and fail without Docker). **Not chosen:** turning confirmations off in `config.toml` for faster tests (local would not match production AUTH-7). **Not chosen:** treating Storage/ingest as passing while the container is down.

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
├── lib/                   # Pure helpers + *.test.ts (npm test)
├── integration/           # *.integration.test.ts (npm run test:integration)
├── pages/
│   ├── DashboardPage.tsx
│   └── LibraryPage.tsx
├── types.ts
├── supabaseClient.ts
├── App.tsx
├── main.tsx
└── index.css
vitest.integration.config.ts
```

`pages/LoginPage.tsx` and `pages/ProfilePage.tsx` exist but are unused. Schema: `supabase/migrations/` (init, grok key, reference/example caps, vector chunk metadata).

## Specs

Intent and remaining work (not this walkthrough):

- **Index**: [`.docs/README.md`](.docs/README.md)
- **PRD**: [`.docs/PRODUCT_REQUIREMENTS.md`](.docs/PRODUCT_REQUIREMENTS.md)
- **Tech spec**: [`.docs/TECHNICAL_SPECIFICATION.md`](.docs/TECHNICAL_SPECIFICATION.md) (as-built tests: §12)
- **Generate slices**: [`.docs/GENERATION_SLICES.md`](.docs/GENERATION_SLICES.md)
- **Gap analysis**: [`.docs/GAP_ANALYSIS.md`](.docs/GAP_ANALYSIS.md) (NFR-7)

Superseded drafts: [`.docs/legacy/`](.docs/legacy/).

## License

This project is for personal/educational use.
