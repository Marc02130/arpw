# AI Research Paper Writer (ARPW)

A web-based AI-powered application designed to assist academic users in generating research paper drafts using Supabase, Langchain, and Grok API.

## Features

- **User Authentication**: Secure login/signup with Supabase Auth
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

Local stack: Vite on port 3000 + Supabase CLI (Postgres, Auth, Storage).

Paper generation, quality checks, and export are not implemented yet. Auth, document upload UI, and the library shell are.

### 1. Install dependencies

```bash
npm install
```

You also need Docker Desktop (for `supabase start`) and the [Supabase CLI](https://supabase.com/docs/guides/cli).

### 2. Start local Supabase

```bash
supabase start
```

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

Open `http://localhost:5173`. Sign up with any email/password (confirmations are off locally). Port 3000 is left free for other apps.

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
├── components/          # Reusable UI components
│   └── Layout.tsx      # Main layout with navigation
├── pages/              # Page components
│   ├── LoginPage.tsx   # Authentication page
│   ├── DashboardPage.tsx # Paper generation interface
│   ├── ProfilePage.tsx # User profile management
│   └── LibraryPage.tsx # Paper library and version history
├── types.ts            # TypeScript interfaces and enums
├── supabaseClient.ts   # Supabase client configuration
├── App.tsx            # Main app component with routing
├── main.tsx           # Application entry point
└── index.css          # Global styles with Tailwind
```

## Documentation

- **Product Requirements**: `.docs/AI_Research_Paper_Writer_PRD.markdown`
- **Technical Documentation**: `.docs/AI_Research_Paper_Writer_Technical_Doc.markdown`
- **User Stories**: `.docs/AI_Research_Paper_Writer_User_Stories.markdown`

## License

This project is for personal/educational use.
