-- NFR-1: authenticated users may only touch objects under {auth.uid()}/.
-- Matches NFR-2 keys `{user_id}/{file_id}`. Service role (ingest) bypasses RLS.

DROP POLICY IF EXISTS "Authenticated read own buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert own buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own buckets" ON storage.objects;

DROP POLICY IF EXISTS "Users read own storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Users insert own storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own storage objects" ON storage.objects;

CREATE POLICY "Users read own storage objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('references', 'examples', 'papers')
  AND split_part(name, '/', 1) = auth.uid()::text
  AND name LIKE auth.uid()::text || '/%'
);

CREATE POLICY "Users insert own storage objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('references', 'examples', 'papers')
  AND split_part(name, '/', 1) = auth.uid()::text
  AND name LIKE auth.uid()::text || '/%'
);

CREATE POLICY "Users delete own storage objects"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('references', 'examples', 'papers')
  AND split_part(name, '/', 1) = auth.uid()::text
  AND name LIKE auth.uid()::text || '/%'
);
