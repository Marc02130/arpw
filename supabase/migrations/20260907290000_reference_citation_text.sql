-- Publisher/catalog preformatted citation, editable by the owner.

ALTER TABLE public."references"
  ADD COLUMN IF NOT EXISTS citation_text text;
