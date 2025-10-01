// Enums
export enum PaperType {
  EMPIRICAL_STUDY = 'Empirical Study',
  LITERATURE_REVIEW = 'Literature Review',
  THEORETICAL_PAPER = 'Theoretical Paper',
  CASE_STUDY = 'Case Study'
}

export enum CitationStyle {
  APA = 'APA',
  MLA = 'MLA',
  CHICAGO = 'Chicago'
}

export enum OutputFormat {
  WORD = 'word',
  MARKDOWN = 'markdown'
}

export enum Status {
  DRAFT = 'draft',
  COMPLETED = 'completed'
}

export enum DocumentType {
  REFERENCE = 'reference',
  EXAMPLE = 'example'
}

// Core Interfaces
export interface UserProfile {
  user_id: string
  email: string
  full_name: string | null
  created_at: string
  updated_at: string
}

export interface Reference {
  file_id: string
  user_id: string
  document_type: DocumentType.REFERENCE
  file_name: string
  file_size: number
  uploaded_at: string
}

export interface Example {
  file_id: string
  user_id: string
  document_type: DocumentType.EXAMPLE
  file_name: string
  file_size: number
  uploaded_at: string
}

export interface Paper {
  paper_id: string
  user_id: string
  title: string
  content: string
  sections: string[]
  paper_type: PaperType
  citation_style: CitationStyle
  output_format: OutputFormat
  version: number
  created_at: string
  status: Status
}

export interface PaperReference {
  paper_id: string
  file_id: string
}

// Vector storage interfaces
export interface ReferenceVector {
  vector_id: string
  file_id: string
  vector: number[] // 384 dimensions for all-MiniLM-L6-v2
  chunk_text: string
}

export interface ExampleVector {
  vector_id: string
  file_id: string
  vector: number[] // 384 dimensions for all-MiniLM-L6-v2
  chunk_text: string
}

// UI State interfaces
export interface PaperGenerationConfig {
  prompt: string
  sections: string[]
  paper_type: PaperType
  citation_style: CitationStyle
  output_format: OutputFormat
}

export interface QualityCheckResult {
  citations: {
    score: number
    issues: string[]
  }
  accuracy: {
    score: number
    issues: string[]
  }
  format: {
    score: number
    issues: string[]
  }
}

export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}

// API Response interfaces
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface GenerationProgress {
  step: 'vectorization' | 'rag' | 'generation' | 'quality_checks' | 'completed'
  progress: number
  message: string
}

// Form interfaces
export interface LoginForm {
  email: string
  password: string
}

export interface SignupForm {
  email: string
  password: string
  confirmPassword: string
  fullName?: string
}

export interface ProfileForm {
  full_name: string
  grok_api_key?: string
}

// Navigation interfaces
export interface NavItem {
  name: string
  href: string
  icon?: string
  current?: boolean
}

// Library interfaces
export interface LibraryPaper {
  paper: Paper
  referenceCount: number
  lastModified: string
}

export interface VersionHistory {
  title: string
  versions: Paper[]
}

// Export interfaces
export interface ExportOptions {
  format: OutputFormat
  includeChecks: boolean
  includeDisclaimer: boolean
}

export interface ExportResult {
  downloadUrl: string
  fileName: string
  format: OutputFormat
}
