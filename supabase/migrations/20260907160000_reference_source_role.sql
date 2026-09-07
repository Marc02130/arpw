-- DOCS-8 / generate slice 1: literature vs this-study (primary) on references only.

ALTER TABLE public."references"
  ADD COLUMN IF NOT EXISTS source_role text NOT NULL DEFAULT 'literature';

ALTER TABLE public."references"
  DROP CONSTRAINT IF EXISTS references_source_role_check;

ALTER TABLE public."references"
  ADD CONSTRAINT references_source_role_check
  CHECK (source_role IN ('literature', 'primary'));
