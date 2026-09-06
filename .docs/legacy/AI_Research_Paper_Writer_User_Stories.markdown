# User Stories: AI Research Paper Writer (ARPW)

## 1. Overview
This document outlines user stories for the ARPW MVP, a web-based application for generating research paper drafts. The stories focus on the needs of professors, researchers, and principal investigators, covering authentication, document management, paper generation, quality checks, export, and library/version management. Authentication is limited to Supabase email/password (no OAuth for MVP). Each story includes acceptance criteria to ensure functionality aligns with user expectations.

## 2. User Stories
### 2.1 User Management
- **Story 1.1**: As a new user, I want to sign up with my email and password so I can access the app securely.
  - **Acceptance Criteria**:
    - Sign-up form supports email/password only (no OAuth).
    - Successful sign-up creates a `user_profile` entry linked to `auth.users.user_id`.
    - User receives confirmation email via Supabase Auth.
    - Redirects to dashboard post-sign-up.
- **Story 1.2**: As a returning user, I want to log in with my email and password so I can access my library and settings.
  - **Acceptance Criteria**:
    - Login form supports email/password only.
    - Invalid credentials show clear error message.
    - Successful login redirects to dashboard with user’s library.
- **Story 1.3**: As a user, I want to update my profile (e.g., full name, Grok API key) so I can customize my experience.
  - **Acceptance Criteria**:
    - Profile page allows editing name and storing encrypted API key.
    - Updates saved to `user_profile` with RLS (`user_id = auth.uid()`).
    - Success/error messages displayed.

### 2.2 Document Management
- **Story 2.1**: As a researcher, I want to upload up to 500 reference documents (PDF, DOC, TXT; max 10MB each) so they can be used for citations.
  - **Acceptance Criteria**:
    - Drag-and-drop upload zone for references.
    - Validates file type and size; shows error if invalid.
    - Uploads stored in Supabase Storage (`references` bucket).
    - Metadata saved in `references` table (`document_type = "reference"`).
    - Progress bar for batch uploads (50-100 files).
    - RLS restricts access to `user_id = auth.uid()`.
- **Story 2.2**: As a researcher, I want to upload up to 10 example papers (PDF, DOC, TXT; max 10MB each) so the AI can emulate their style.
  - **Acceptance Criteria**:
    - Separate upload zone for examples.
    - Same validation and storage as references (`examples` bucket, `document_type = "example"`).
    - RLS enforced.
- **Story 2.3**: As a user, I want to view or delete my uploaded documents so I can manage my storage.
  - **Acceptance Criteria**:
    - Dashboard tab lists uploaded references/examples (file name, size, date).
    - Delete button removes file from Storage and metadata from tables.
    - RLS ensures only user’s files are accessible.

### 2.3 Paper Generation
- **Story 3.1**: As a professor, I want to enter a research prompt and select sections (Abstract, Introduction, Methods, Results, Discussion, Conclusion) so the draft matches my needs.
  - **Acceptance Criteria**:
    - Prompt text area accepts free-form input.
    - Checkboxes for sections (default: all selected).
    - Selected sections saved in `user_papers.sections` (text array).
    - Generated draft includes only selected sections with logical flow.
- **Story 3.2**: As a principal investigator, I want to choose a paper type (Empirical Study, Literature Review, Theoretical Paper, Case Study) and citation style (APA) so the output is formatted correctly.
  - **Acceptance Criteria**:
    - Radio buttons for paper types and citation style (APA for MVP).
    - Selections saved in `user_papers` (`paper_type`, `citation_style`).
    - Draft adheres to selected type (e.g., IMRaD for Empirical Study) and APA citations.
- **Story 3.3**: As a researcher, I want an outline mode to review and edit the paper structure before generating the full draft.
  - **Acceptance Criteria**:
    - "Generate Outline" button produces high-level structure via Grok.
    - Editable outline in UI (Markdown preview).
    - User can confirm or modify before full generation.
    - Outline stored as draft in `user_papers` (`status = "draft"`).

### 2.4 Quality Checks and Output
- **Story 4.1**: As a researcher, I want automated checks for citations, factual accuracy, and format so I can identify potential issues before export.
  - **Acceptance Criteria**:
    - Checks run post-generation:
      - Citations: Flag if >10% sentences lack citations; verify against `paper_references`.
      - Accuracy: Flag claims with low similarity (<0.7) to reference vectors.
      - Format: Ensure sections match `user_papers.sections` and APA structure.
    - Inline warnings in preview (e.g., "⚠ Methods: Uncited claim").
- **Story 4.2**: As a user, I want to preview the generated draft with a disclaimer so I remember to review it thoroughly.
  - **Acceptance Criteria**:
    - Preview shows Markdown draft with flags and footer: "AI-generated draft. Requires human review."
    - Preview is editable (basic text tweaks) before export.
- **Story 4.3**: As a user, I want to export my draft as Word (.docx) or Markdown (.md) so I can edit externally.
  - **Acceptance Criteria**:
    - Radio buttons for export format.
    - Word export uses `docx` library; Markdown uses raw content.
    - Exported file stored in `papers` bucket; download link provided.
    - Includes checks summary and disclaimer.

### 2.5 Library and Version History
- **Story 5.1**: As a user, I want a library dashboard to view my papers (title, date, status) so I can organize my work.
  - **Acceptance Criteria**:
    - Library tab shows table of `user_papers` (title, created_at, status).
    - Filter/sort by title/date.
    - RLS ensures only user’s papers visible.
- **Story 5.2**: As a researcher, I want version history for each paper title so I can track iterations.
  - **Acceptance Criteria**:
    - Papers with same title/user_id increment `version` in `user_papers`.
    - Library groups versions by title; displays version number.
    - Click to view specific version content.
- **Story 5.3**: As a user, I want to regenerate or delete old versions so I can manage iterations.
  - **Acceptance Criteria**:
    - "Regenerate" button uses same title/config; creates new version.
    - "Delete" button removes specific version (`paper_id`, RLS-checked).
    - UI confirms deletion to prevent errors.

## 3. General Acceptance Criteria
- **Security**: All features respect RLS (`user_id = auth.uid()`).
- **Accessibility**: UI meets WCAG 2.1 AA; keyboard-navigable.
- **Performance**: Uploads <2 min/batch; generation <5 min; exports <10s.
- **Error Handling**: Clear messages for invalid uploads, failed generations, etc.
- **Responsive Design**: Works on 13"+ screens; mobile support out of scope for MVP.