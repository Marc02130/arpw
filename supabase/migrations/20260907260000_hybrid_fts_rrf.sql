-- Hybrid retrieve: cosine + English FTS, fused with reciprocal rank fusion (k=60).
-- Light rerank: RRF score, then prefer matching stored section.

ALTER TABLE public.reference_vectors
  ADD COLUMN IF NOT EXISTS chunk_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(chunk_text, ''))) STORED;

ALTER TABLE public.example_vectors
  ADD COLUMN IF NOT EXISTS chunk_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(chunk_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_reference_vectors_chunk_tsv
  ON public.reference_vectors USING GIN (chunk_tsv);

CREATE INDEX IF NOT EXISTS idx_example_vectors_chunk_tsv
  ON public.example_vectors USING GIN (chunk_tsv);

DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text);
DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text, text);
DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text, text, text);
DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text, text, text, text);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer, text);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer, text, text);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer, text, text, text);

CREATE FUNCTION public.match_reference_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 12,
  filter_role text DEFAULT NULL,
  prefer_section text DEFAULT NULL,
  filter_model text DEFAULT 'hash-384',
  query_text text DEFAULT NULL
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
  WITH params AS (
    SELECT
      LEAST(GREATEST(COALESCE(match_count, 12), 1), 20) AS k,
      LEAST(GREATEST(COALESCE(match_count, 12), 1) * 2, 40) AS pool,
      nullif(btrim(query_text), '') AS qtext,
      coalesce(nullif(btrim(filter_model), ''), 'hash-384') AS model
  ),
  filtered AS (
    SELECT
      v.vector_id,
      v.file_id,
      v.chunk_text,
      v.section,
      v.page,
      v.chunk_tsv,
      r.source_role,
      (v.vector <=> query_embedding) AS dist
    FROM public.reference_vectors v
    JOIN public."references" r ON r.file_id = v.file_id
    WHERE r.user_id = auth.uid()
      AND coalesce(v.embedding_model, 'hash-384') = (SELECT model FROM params)
      AND (
        filter_role IS NULL
        OR filter_role = 'both'
        OR r.source_role = filter_role
      )
  ),
  vec AS (
    SELECT vector_id, rnk FROM (
      SELECT vector_id, ROW_NUMBER() OVER (ORDER BY dist) AS rnk
      FROM filtered
    ) ranked
    WHERE rnk <= (SELECT pool FROM params)
  ),
  fts AS (
    SELECT vector_id, rnk FROM (
      SELECT
        vector_id,
        ROW_NUMBER() OVER (
          ORDER BY ts_rank_cd(chunk_tsv, plainto_tsquery('english', (SELECT qtext FROM params))) DESC
        ) AS rnk
      FROM filtered
      WHERE (SELECT qtext FROM params) IS NOT NULL
        AND chunk_tsv @@ plainto_tsquery('english', (SELECT qtext FROM params))
    ) ranked
    WHERE rnk <= (SELECT pool FROM params)
  ),
  fused AS (
    SELECT
      f.vector_id,
      f.file_id,
      f.chunk_text,
      f.section,
      f.source_role,
      f.page,
      (1 - f.dist)::double precision AS cosine_score,
      COALESCE((SELECT 1.0 / (60 + vec.rnk) FROM vec WHERE vec.vector_id = f.vector_id), 0)
        + COALESCE((SELECT 1.0 / (60 + fts.rnk) FROM fts WHERE fts.vector_id = f.vector_id), 0)
        AS rrf
    FROM filtered f
    WHERE f.vector_id IN (SELECT vector_id FROM vec UNION SELECT vector_id FROM fts)
  )
  SELECT
    fused.vector_id,
    fused.file_id,
    fused.chunk_text,
    fused.section,
    fused.source_role,
    fused.cosine_score AS score,
    fused.page
  FROM fused
  ORDER BY
    CASE
      WHEN prefer_section IS NULL OR btrim(prefer_section) = '' THEN 0
      WHEN lower(coalesce(fused.section, '')) = lower(btrim(prefer_section)) THEN 0
      ELSE 1
    END,
    fused.rrf DESC,
    fused.cosine_score DESC
  LIMIT (SELECT k FROM params);
$$;

CREATE FUNCTION public.match_example_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 6,
  prefer_section text DEFAULT NULL,
  filter_model text DEFAULT 'hash-384',
  query_text text DEFAULT NULL
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
  WITH params AS (
    SELECT
      LEAST(GREATEST(COALESCE(match_count, 6), 1), 10) AS k,
      LEAST(GREATEST(COALESCE(match_count, 6), 1) * 2, 20) AS pool,
      nullif(btrim(query_text), '') AS qtext,
      coalesce(nullif(btrim(filter_model), ''), 'hash-384') AS model
  ),
  filtered AS (
    SELECT
      v.vector_id,
      v.file_id,
      v.chunk_text,
      v.section,
      v.page,
      v.chunk_tsv,
      (v.vector <=> query_embedding) AS dist
    FROM public.example_vectors v
    JOIN public.examples e ON e.file_id = v.file_id
    WHERE e.user_id = auth.uid()
      AND coalesce(v.embedding_model, 'hash-384') = (SELECT model FROM params)
  ),
  vec AS (
    SELECT vector_id, rnk FROM (
      SELECT vector_id, ROW_NUMBER() OVER (ORDER BY dist) AS rnk
      FROM filtered
    ) ranked
    WHERE rnk <= (SELECT pool FROM params)
  ),
  fts AS (
    SELECT vector_id, rnk FROM (
      SELECT
        vector_id,
        ROW_NUMBER() OVER (
          ORDER BY ts_rank_cd(chunk_tsv, plainto_tsquery('english', (SELECT qtext FROM params))) DESC
        ) AS rnk
      FROM filtered
      WHERE (SELECT qtext FROM params) IS NOT NULL
        AND chunk_tsv @@ plainto_tsquery('english', (SELECT qtext FROM params))
    ) ranked
    WHERE rnk <= (SELECT pool FROM params)
  ),
  fused AS (
    SELECT
      f.vector_id,
      f.file_id,
      f.chunk_text,
      f.section,
      f.page,
      (1 - f.dist)::double precision AS cosine_score,
      COALESCE((SELECT 1.0 / (60 + vec.rnk) FROM vec WHERE vec.vector_id = f.vector_id), 0)
        + COALESCE((SELECT 1.0 / (60 + fts.rnk) FROM fts WHERE fts.vector_id = f.vector_id), 0)
        AS rrf
    FROM filtered f
    WHERE f.vector_id IN (SELECT vector_id FROM vec UNION SELECT vector_id FROM fts)
  )
  SELECT
    fused.vector_id,
    fused.file_id,
    fused.chunk_text,
    fused.section,
    fused.cosine_score AS score,
    fused.page
  FROM fused
  ORDER BY
    CASE
      WHEN prefer_section IS NULL OR btrim(prefer_section) = '' THEN 0
      WHEN lower(coalesce(fused.section, '')) = lower(btrim(prefer_section)) THEN 0
      ELSE 1
    END,
    fused.rrf DESC,
    fused.cosine_score DESC
  LIMIT (SELECT k FROM params);
$$;

REVOKE ALL ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text, text, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.match_example_chunks(extensions.vector, integer, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_example_chunks(extensions.vector, integer, text, text, text)
  TO authenticated;
