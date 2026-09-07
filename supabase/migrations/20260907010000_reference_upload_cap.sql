-- DOCS-1: references are PDF/DOCX/TXT, max 10 MiB (already on file_size), 500 per user.

ALTER TABLE public."references"
  DROP CONSTRAINT IF EXISTS references_file_name_ext;

ALTER TABLE public."references"
  ADD CONSTRAINT references_file_name_ext
  CHECK (file_name ~* '\.(pdf|docx|txt)$');

CREATE OR REPLACE FUNCTION public.enforce_reference_file_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public."references" WHERE user_id = NEW.user_id) >= 500 THEN
    RAISE EXCEPTION 'Reference cap of 500 files reached'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS references_file_cap ON public."references";

CREATE TRIGGER references_file_cap
  BEFORE INSERT ON public."references"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reference_file_cap();
