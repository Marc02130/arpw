-- Reject filesystem paths and require the xAI `xai-` prefix when saving a Grok key.

CREATE OR REPLACE FUNCTION public.set_grok_api_key(api_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  uid uuid := auth.uid();
  trimmed text := btrim(api_key);
  suffix text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF trimmed IS NULL OR length(trimmed) < 10 THEN
    RAISE EXCEPTION 'API key appears to be too short';
  END IF;
  IF left(trimmed, 1) = '/'
     OR left(trimmed, 2) = './'
     OR left(trimmed, 3) = '../'
     OR left(trimmed, 5) = 'file:'
     OR position(chr(92) in trimmed) > 0 THEN
    RAISE EXCEPTION 'API key looks like a file path, not an xAI key';
  END IF;
  IF left(trimmed, 4) IS DISTINCT FROM 'xai-' THEN
    RAISE EXCEPTION 'API key must start with xai-';
  END IF;

  suffix := right(trimmed, 4);

  INSERT INTO public.user_grok_keys (user_id, ciphertext, last4, updated_at)
  VALUES (
    uid,
    extensions.pgp_sym_encrypt(trimmed, private.grok_enc_key()),
    suffix,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET ciphertext = EXCLUDED.ciphertext,
        last4 = EXCLUDED.last4,
        updated_at = now();

  RETURN jsonb_build_object('set', true, 'last4', suffix);
END;
$$;
