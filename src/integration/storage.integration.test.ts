import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { storageObjectKey } from '../../supabase/functions/upload_processor/ingest'
import {
  assertSupabaseUp,
  createConfirmedUser,
  deleteUser,
  storageIsUp,
} from './supabaseTest'

const policySql = `
select polname
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage' and c.relname = 'objects'
order by 1
`

const listStoragePolicies = (): string =>
  execFileSync(
    'docker',
    ['exec', 'supabase_db_arpw', 'psql', '-U', 'postgres', '-tA', '-c', policySql],
    { encoding: 'utf8' }
  )

describe('storage RLS integration (NFR-1)', () => {
  let storageUp = false

  beforeAll(async () => {
    await assertSupabaseUp()
    storageUp = await storageIsUp()
  })

  it('should replace bucket-wide storage policies with user-prefix policies', () => {
    const names = listStoragePolicies()
    expect(names).toContain('Users read own storage objects')
    expect(names).toContain('Users insert own storage objects')
    expect(names).toContain('Users delete own storage objects')
    expect(names).not.toContain('Authenticated read own buckets')
    expect(names).not.toContain('Authenticated insert own buckets')
    expect(names).not.toContain('Authenticated delete own buckets')
  })

  it('should block another user from reading, writing, or deleting an object', async (ctx) => {
    if (!storageUp) {
      ctx.skip()
      return
    }

    const owner = await createConfirmedUser('stor-a')
    const other = await createConfirmedUser('stor-b')
    const fileId = randomUUID()
    const key = storageObjectKey(owner.id, fileId)
    const body = new Blob(['secret reference text\n'], { type: 'text/plain' })
    try {
      const { error: uploadError } = await owner.client.storage.from('references').upload(key, body, {
        contentType: 'text/plain',
        upsert: false,
      })
      expect(uploadError).toBeNull()

      const { data: asOwner, error: ownerRead } = await owner.client.storage.from('references').download(key)
      expect(ownerRead).toBeNull()
      expect(asOwner).toBeTruthy()

      const { error: otherUpload } = await other.client.storage
        .from('references')
        .upload(key, body, { contentType: 'text/plain', upsert: true })
      expect(otherUpload).toBeTruthy()

      const { data: asOther, error: otherRead } = await other.client.storage.from('references').download(key)
      expect(asOther).toBeNull()
      expect(otherRead).toBeTruthy()

      const { error: otherDelete } = await other.client.storage.from('references').remove([key])
      expect(otherDelete).toBeTruthy()

      const { data: stillThere } = await owner.client.storage.from('references').download(key)
      expect(stillThere).toBeTruthy()
    } finally {
      await owner.client.storage.from('references').remove([key])
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })
})
