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

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Grok API Configuration (Optional - can be set in user profile)
VITE_GROK_API_KEY=your-grok-api-key
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Enable the `pgvector` extension in your database
3. Run the database migrations (see `.docs/` folder for schema)
4. Set up Row Level Security (RLS) policies
5. Configure Supabase Storage buckets for `references`, `examples`, and `papers`

### 4. Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

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
