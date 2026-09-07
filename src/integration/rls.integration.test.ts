import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { hashEmbedding } from '../../supabase/functions/upload_processor/ingest'
import { assertSupabaseUp, createConfirmedUser, deleteUser } from './supabaseTest'

describe('RLS integration', () => {
  beforeAll(assertSupabaseUp)

  it('should hide another user\'s references, examples, profile, and papers', async () => {
    const owner = await createConfirmedUser('rls-a')
    const other = await createConfirmedUser('rls-b')
    const fileId = randomUUID()
    const exampleId = randomUUID()
    try {
      const { error: refError } = await owner.client.from('references').insert({
        file_id: fileId,
        user_id: owner.id,
        document_type: 'reference',
        file_name: 'secret.txt',
        file_size: 16,
      })
      expect(refError).toBeNull()

      const { error: exError } = await owner.client.from('examples').insert({
        file_id: exampleId,
        user_id: owner.id,
        document_type: 'example',
        file_name: 'style.txt',
        file_size: 12,
      })
      expect(exError).toBeNull()

      const { error: paperError } = await owner.client.from('user_papers').insert({
        user_id: owner.id,
        title: 'Secret paper',
        content: 'body',
        sections: ['intro'],
        paper_type: 'Empirical Study',
        citation_style: 'APA',
        output_format: 'markdown',
      })
      expect(paperError).toBeNull()

      const { data: refsAsOther } = await other.client.from('references').select('file_id').eq('file_id', fileId)
      expect(refsAsOther).toEqual([])

      const { data: exAsOther } = await other.client.from('examples').select('file_id').eq('file_id', exampleId)
      expect(exAsOther).toEqual([])

      const { data: profileAsOther } = await other.client
        .from('user_profile')
        .select('user_id')
        .eq('user_id', owner.id)
      expect(profileAsOther).toEqual([])

      const { data: papersAsOther } = await other.client
        .from('user_papers')
        .select('title')
        .eq('user_id', owner.id)
      expect(papersAsOther).toEqual([])

      const { data: asOwner } = await owner.client.from('references').select('file_id').eq('file_id', fileId)
      expect(asOwner?.map((row) => row.file_id)).toEqual([fileId])
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await owner.client.from('examples').delete().eq('user_id', owner.id)
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should reject inserting a reference as another user', async () => {
    const owner = await createConfirmedUser('rls-insert-a')
    const other = await createConfirmedUser('rls-insert-b')
    try {
      const { error } = await other.client.from('references').insert({
        file_id: randomUUID(),
        user_id: owner.id,
        document_type: 'reference',
        file_name: 'stolen.txt',
        file_size: 16,
      })
      expect(error).toBeTruthy()
    } finally {
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should reject reading or writing another user\'s vectors', async () => {
    const owner = await createConfirmedUser('rls-vec-a')
    const other = await createConfirmedUser('rls-vec-b')
    const fileId = randomUUID()
    try {
      const { error: refError } = await owner.client.from('references').insert({
        file_id: fileId,
        user_id: owner.id,
        document_type: 'reference',
        file_name: 'owned.txt',
        file_size: 20,
      })
      expect(refError).toBeNull()

      const { error: vecError } = await owner.client.from('reference_vectors').insert({
        file_id: fileId,
        vector: hashEmbedding('owned chunk'),
        chunk_text: 'owned chunk',
        chunk_index: 0,
        section: 'owned chunk',
        embedding_model: 'hash-384',
      })
      expect(vecError).toBeNull()

      const { data: asOther } = await other.client
        .from('reference_vectors')
        .select('file_id')
        .eq('file_id', fileId)
      expect(asOther).toEqual([])

      const { error: insertAsOther } = await other.client.from('reference_vectors').insert({
        file_id: fileId,
        vector: hashEmbedding('injected'),
        chunk_text: 'injected',
        chunk_index: 1,
        section: 'injected',
        embedding_model: 'hash-384',
      })
      expect(insertAsOther).toBeTruthy()
    } finally {
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should not let another user change the owner\'s profile name', async () => {
    const owner = await createConfirmedUser('rls-name-a')
    const other = await createConfirmedUser('rls-name-b')
    try {
      await owner.client.from('user_profile').update({ full_name: 'Owner' }).eq('user_id', owner.id)
      await other.client.from('user_profile').update({ full_name: 'Hacked' }).eq('user_id', owner.id)

      const { data } = await owner.client
        .from('user_profile')
        .select('full_name')
        .eq('user_id', owner.id)
        .single()
      expect(data?.full_name).toBe('Owner')
    } finally {
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should not let another user change source_role', async () => {
    const owner = await createConfirmedUser('rls-role-a')
    const other = await createConfirmedUser('rls-role-b')
    const fileId = randomUUID()
    try {
      const { error } = await owner.client.from('references').insert({
        file_id: fileId,
        user_id: owner.id,
        document_type: 'reference',
        file_name: 'owned.txt',
        file_size: 20,
      })
      expect(error).toBeNull()

      await other.client.from('references').update({ source_role: 'primary' }).eq('file_id', fileId)

      const { data } = await owner.client
        .from('references')
        .select('source_role')
        .eq('file_id', fileId)
        .single()
      expect(data?.source_role).toBe('literature')
    } finally {
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })
})
