-- Title-page bibliographic fields for academic References lists.

ALTER TABLE public."references"
  ADD COLUMN IF NOT EXISTS bibliographic jsonb;
