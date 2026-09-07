-- DOCS-5: store chunk index/section and which embedding model produced the vector.

ALTER TABLE public.reference_vectors
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS embedding_model text DEFAULT 'hash-384';

ALTER TABLE public.example_vectors
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS embedding_model text DEFAULT 'hash-384';
