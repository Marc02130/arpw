-- Move Grok API keys off user_profile so PostgREST select * cannot return them.
-- Authenticated clients may set, clear, and see {set, last4} via RPCs.
-- Only service_role can decrypt (future Edge generation).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE TABLE IF NOT EXISTS private.secrets (
  id text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO private.secrets (id, value)
VALUES ('grok_key_enc', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON TABLE private.secrets FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.grok_enc_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT value FROM private.secrets WHERE id = 'grok_key_enc';
$$;

REVOKE ALL ON FUNCTION private.grok_enc_key() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.user_grok_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  ciphertext bytea NOT NULL,
  last4 text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_grok_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_grok_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_grok_keys TO postgres, service_role;

-- Copy any keys that were saved as plaintext on the profile, then drop the column.
INSERT INTO public.user_grok_keys (user_id, ciphertext, last4, updated_at)
SELECT
  user_id,
  extensions.pgp_sym_encrypt(trim(grok_api_key), private.grok_enc_key()),
  right(trim(grok_api_key), 4),
  now()
FROM public.user_profile
WHERE grok_api_key IS NOT NULL
  AND length(trim(grok_api_key)) > 0
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.user_profile DROP COLUMN IF EXISTS grok_api_key;

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

CREATE OR REPLACE FUNCTION public.clear_grok_api_key()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.user_grok_keys WHERE user_id = uid;
  RETURN jsonb_build_object('set', false, 'last4', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.grok_api_key_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  suffix text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT last4 INTO suffix FROM public.user_grok_keys WHERE user_id = uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('set', false, 'last4', null);
  END IF;
  RETURN jsonb_build_object('set', true, 'last4', suffix);
END;
$$;

-- Decrypt for Edge Functions / workers. JWT role must be service_role.
CREATE OR REPLACE FUNCTION public.read_grok_api_key(for_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  plain text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT extensions.pgp_sym_decrypt(ciphertext, private.grok_enc_key())
    INTO plain
  FROM public.user_grok_keys
  WHERE user_id = for_user;

  RETURN plain;
END;
$$;

REVOKE ALL ON FUNCTION public.set_grok_api_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_grok_api_key(text) TO authenticated;

REVOKE ALL ON FUNCTION public.clear_grok_api_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_grok_api_key() TO authenticated;

REVOKE ALL ON FUNCTION public.grok_api_key_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grok_api_key_status() TO authenticated;

REVOKE ALL ON FUNCTION public.read_grok_api_key(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_grok_api_key(uuid) TO service_role;
