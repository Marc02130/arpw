# Product Requirements Document (PRD): AI Research Paper Writer (ARPW)

## 1. Document Information
- **Product Name**: AI Research Paper Writer (ARPW)
- **Version**: 1.0 (MVP)
- **Author**: [Your Name] (Personal Project)
- **Date**: September 30, 2025
- **Status**: Draft for MVP Development
- **Overview**: ARPW is a web-based AI-powered application designed to assist academic users (professors, researchers, principal investigators) in generating research paper drafts. It uses Supabase for vector storage, authentication, and backend logic, with Grok (xAI API) for text generation and Langchain for embeddings. The app supports up to 500 reference documents and 10 example papers, generates APA-style papers (extensible to other styles), and includes a user library for storing multiple papers with version history. Security is enhanced by leveraging Supabase `auth.users.user_id` for user management.

## 2. Goals and Objectives
### Business Goals
- Streamline research paper drafting, reducing time from hours to minutes.
- Ensure ethical AI use with outputs grounded in user-uploaded sources and mandatory human review.

### User Goals
- Generate customizable paper drafts (select sections, paper types, citation styles) using up to 500 references and 10 example papers (PDF, DOC, TXT).
- Store and manage multiple papers in a secure personal library, including version history for each paper title.
- Export drafts in Word or Markdown with automated checks for citations, factual accuracy, and format.

### Success Metrics (Post-MVP)
- User satisfaction: 80%+ report time savings (in-app feedback).
- Output quality: 90%+ pass rate on citation/format/accuracy checks.
- Adoption: Functional MVP tested by 5+ users (personal network).

## 3. Target Audience
- **Primary Users**: Professors, researchers, principal investigators in academia/R&D.
- **Use Cases**:
  - Drafting journal articles, conference papers, or grant proposals.
  - Creating literature reviews or empirical studies in APA-focused fields (e.g., social sciences, STEM).
- **User Personas**:
  - **Dr. Elena Researcher**: Mid-career professor needing quick, accurate drafts for publications.
  - **Dr. Alex PI**: Principal investigator managing multiple projects; values library storage, version history, and export options.
- **Assumptions**: Users are tech-savvy, have Grok API access, and will thoroughly review AI outputs for accuracy.

## 4. Key Features and Requirements
### Functional Requirements
#### 4.1 User Management
- **Authentication**: Supabase Authentication (email/password).
- **User Profile**: Store basic user info, synced with `auth.users.user_id` for security.

#### 4.2 Document and Library Management
- **Reference and Example Uploads**: Support up to 500 references and 10 examples (PDF, DOC, TXT; max 10 MB each); store with metadata including document type.
- **Library**: Secure personal library for storing multiple papers; include version history per paper title (e.g., auto-save new versions on regeneration; allow deletion of old versions).

#### 4.3 Paper Generation
- **Customization**: Select sections (e.g., Abstract, Introduction), paper type (e.g., Empirical Study), citation style (APA default).
- **Generation**: Use RAG with uploaded vectors; generate drafts via Grok.
- **Storage**: Save configurations (sections, paper type, citation style) with each paper/version in the library.

#### 4.4 Output and Quality Checks
- **Output**: Drafts with citations limited to uploads; automated checks for citations, accuracy, format.
- **Export**: Word (.docx) or Markdown (.md); include disclaimers.

#### 4.5 Additional MVP Features
- **Outline Mode**: Generate editable outline before full draft.
- **Version Management**: View, regenerate, and delete versions within a paper's history.

### Non-Functional Requirements
- **Performance**: Generation <5 min; vectorization <2 min/batch.
- **Security/Privacy**: RLS via `auth.users.user_id`; encrypted storage; temp vectors.
- **Accessibility**: WCAG 2.1 AA.
- **Platform**: Web-based.
- **Scalability**: Single-user focus.

## 5. User Interface and Experience
- **High-Level Flows**: Login → Dashboard (library, uploads, prompt) → Customize/Generate → Preview/Export → Library Management (view versions, delete).
- **Design**: Minimalist; responsive.

## 6. Technical Requirements (High-Level)
- **Stack**: React frontend; Supabase (Auth, Storage, Postgres, Edge Functions); Langchain embeddings; Grok API.
- **Integrations**: Supabase-centric; xAI Grok.

## 7. MVP Scope
- **In Scope**: Auth, uploads, library with versions, generation, checks, export, outline.
- **Out of Scope**: Advanced styles, collaboration, mobile.
- **Assumptions**: User provides Grok API key.

## 8. Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Grok hallucinations | High | High | RAG; checks; disclaimers. |
| Edge Function latency | Medium | Medium | Optimize batches. |
| Privacy concerns | Low | High | RLS; encryption. |

## 9. Roadmap
- **MVP (Q4 2025)**: Core features.
- **v1.1 (Q1 2026)**: Additional styles; editing.
- **v2.0 (Q2 2026)**: Integrations; multi-user.