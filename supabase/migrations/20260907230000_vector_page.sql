-- DOCS-5: store PDF page on chunks when the parser has it.
-- section remains the canonical IMRaD label from heading-aware ingest.

ALTER TABLE public.reference_vectors
  ADD COLUMN IF NOT EXISTS page integer;

ALTER TABLE public.example_vectors
  ADD COLUMN IF NOT EXISTS page integer;

ALTER TABLE public.reference_vectors
  DROP CONSTRAINT IF EXISTS reference_vectors_page_check;
ALTER TABLE public.reference_vectors
  ADD CONSTRAINT reference_vectors_page_check
  CHECK (page IS NULL OR page >= 1);

ALTER TABLE public.example_vectors
  DROP CONSTRAINT IF EXISTS example_vectors_page_check;
ALTER TABLE public.example_vectors
  ADD CONSTRAINT example_vectors_page_check
  CHECK (page IS NULL OR page >= 1);

CREATE INDEX IF NOT EXISTS idx_reference_vectors_section ON public.reference_vectors (section);
CREATE INDEX IF NOT EXISTS idx_example_vectors_section ON public.example_vectors (section);

DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer);

CREATE FUNCTION public.match_reference_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 12,
  filter_role text DEFAULT NULL
)
RETURNS TABLE (
  vector_id uuid,
  file_id uuid,
  chunk_text text,
  section text,
  source_role text,
  score double precision,
  page integer
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    v.vector_id,
    v.file_id,
    v.chunk_text,
    v.section,
    r.source_role,
    (1 - (v.vector <=> query_embedding))::double precision AS score,
    v.page
  FROM public.reference_vectors v
  JOIN public."references" r ON r.file_id = v.file_id
  WHERE r.user_id = auth.uid()
    AND (
      filter_role IS NULL
      OR filter_role = 'both'
      OR r.source_role = filter_role
    )
  ORDER BY v.vector <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 12), 1), 20);
$$;

CREATE OR REPLACE FUNCTION public.match_example_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 6
)
RETURNS TABLE (
  vector_id uuid,
  file_id uuid,
  chunk_text text,
  section text,
  score double precision,
  page integer
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    v.vector_id,
    v.file_id,
    v.chunk_text,
    v.section,
    (1 - (v.vector <=> query_embedding))::double precision AS score,
    v.page
  FROM public.example_vectors v
  JOIN public.examples e ON e.file_id = v.file_id
  WHERE e.user_id = auth.uid()
  ORDER BY v.vector <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 6), 1), 10);
$$;

REVOKE ALL ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.match_example_chunks(extensions.vector, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_example_chunks(extensions.vector, integer)
  TO authenticated;
