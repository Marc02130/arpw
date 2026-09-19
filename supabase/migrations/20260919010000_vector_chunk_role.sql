-- Academic chunk roles for interrogation. Unlabeled historical rows stay NULL
-- and are classified at query time from chunk_text + section.

ALTER TABLE public.reference_vectors
  ADD COLUMN IF NOT EXISTS chunk_role text;

ALTER TABLE public.example_vectors
  ADD COLUMN IF NOT EXISTS chunk_role text;

ALTER TABLE public.reference_vectors
  DROP CONSTRAINT IF EXISTS reference_vectors_chunk_role_check;
ALTER TABLE public.reference_vectors
  ADD CONSTRAINT reference_vectors_chunk_role_check
  CHECK (
    chunk_role IS NULL
    OR chunk_role IN (
      'claim',
      'finding',
      'evaluation',
      'method',
      'context',
      'experience',
      'citation',
      'boilerplate'
    )
  );

ALTER TABLE public.example_vectors
  DROP CONSTRAINT IF EXISTS example_vectors_chunk_role_check;
ALTER TABLE public.example_vectors
  ADD CONSTRAINT example_vectors_chunk_role_check
  CHECK (
    chunk_role IS NULL
    OR chunk_role IN (
      'claim',
      'finding',
      'evaluation',
      'method',
      'context',
      'experience',
      'citation',
      'boilerplate'
    )
  );

DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text, text, text, text);

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
  page integer,
  chunk_role text
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
      v.chunk_role,
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
      f.chunk_role,
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
    fused.page,
    fused.chunk_role
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
