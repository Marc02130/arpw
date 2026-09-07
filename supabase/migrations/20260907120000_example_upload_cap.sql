-- DOCS-2: example papers use the same types as references, cap 10 per user.

ALTER TABLE public.examples
  DROP CONSTRAINT IF EXISTS examples_file_name_ext;

ALTER TABLE public.examples
  ADD CONSTRAINT examples_file_name_ext
  CHECK (file_name ~* '\.(pdf|docx|txt)$');

CREATE OR REPLACE FUNCTION public.enforce_example_file_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.examples WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Example cap of 10 files reached'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS examples_file_cap ON public.examples;

CREATE TRIGGER examples_file_cap
  BEFORE INSERT ON public.examples
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_example_file_cap();
