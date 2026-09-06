# AI Research Paper Writer (ARPW)

A web-based AI-powered application designed to assist academic users in generating research paper drafts using Supabase, Langchain, and Grok API.

## Features

- **User Authentication**: Open email/password signup, confirmation before access, password reset (Supabase Auth)
- **Document Management**: Upload up to 500 reference documents and 10 example papers
- **Paper Generation**: AI-powered research paper generation with customizable sections
- **Quality Checks**: Automated citation, accuracy, and format validation
- **Library Management**: Store and manage multiple papers with version history
- **Export Options**: Export papers in Word (.docx) or Markdown (.md) format

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Auth, Storage, Database, Edge Functions)
- **AI**: Langchain.js for embeddings, Grok API for text generation
- **Routing**: React Router DOM

## Setup Instructions

Local stack: Vite on port 5173 + Supabase CLI (Postgres, Auth, Storage, mail on 54324).

Paper generation, quality checks, and export are not implemented yet. Auth (including email confirmation and password reset), document upload UI, and the library shell are.

### 1. Install dependencies

```bash
npm install
```

You also need Docker Desktop (for `supabase start`) and the [Supabase CLI](https://supabase.com/docs/guides/cli).

### 2. Start local Supabase

```bash
supabase start
```

Use the installed CLI (`which supabase`, currently Homebrew 2.39.x). Do not use `npx supabase`; a newer CLI pulls different images and can leave Storage unhealthy.

Copy the printed `API URL` and `anon key` into `.env`:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
```

Schema, RLS, and storage buckets (`references`, `examples`, `papers`) come from `supabase/migrations/`.

### 3. Run the app

```bash
npm run dev
```

Open `http://127.0.0.1:5173` (or `http://localhost:5173`). Anyone can sign up. Email confirmation is required before the app opens; locally the message lands in Mailpit/Inbucket at `http://127.0.0.1:54324`. Click the link, then you can use the dashboard. Forgot password uses the same inbox and lands on `/reset-password`. Port 3000 is left free for other apps.

### 4. Build

```bash
npm run build
```

### 5. Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/            # UI actually mounted by the router
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

`pages/LoginPage.tsx` and `pages/ProfilePage.tsx` exist but are unused.

## Documentation

Current:

- **Index**: `.docs/README.md`
- **PRD**: `.docs/PRODUCT_REQUIREMENTS.md`
- **Tech spec**: `.docs/TECHNICAL_SPECIFICATION.md`
- **Gap analysis**: `.docs/GAP_ANALYSIS.md`

Superseded drafts (do not treat as status): `.docs/legacy/`

## License

This project is for personal/educational use.
