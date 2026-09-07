import { beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  anonClient,
  assertSupabaseUp,
  createConfirmedUser,
  deleteUser,
} from './supabaseTest'

describe('grok key integration', () => {
  beforeAll(assertSupabaseUp)

  it('should store a key the SPA cannot read back', async () => {
    const user = await createConfirmedUser('grok')
    const key = 'xai-integration-test-key-zz99'
    try {
      const { data: setData, error: setError } = await user.client.rpc('set_grok_api_key', {
        api_key: key,
      })
      expect(setError).toBeNull()
      expect(setData).toMatchObject({ set: true, last4: 'zz99' })

      const { data: status, error: statusError } = await user.client.rpc('grok_api_key_status')
      expect(statusError).toBeNull()
      expect(status).toMatchObject({ set: true, last4: 'zz99' })

      const { data: profile } = await user.client.from('user_profile').select('*').eq('user_id', user.id).single()
      expect(profile && 'grok_api_key' in profile).toBe(false)

      const { error: tableError } = await user.client.from('user_grok_keys').select('*')
      expect(tableError).toBeTruthy()

      const { data: decrypted, error: readError } = await adminClient().rpc('read_grok_api_key', {
        for_user: user.id,
      })
      expect(readError).toBeNull()
      expect(decrypted).toBe(key)

      const { error: clearError } = await user.client.rpc('clear_grok_api_key')
      expect(clearError).toBeNull()
      const { data: after } = await user.client.rpc('grok_api_key_status')
      expect(after).toMatchObject({ set: false, last4: null })
    } finally {
      await deleteUser(user.id)
    }
  })

  it('should reject a key shorter than 10 characters', async () => {
    const user = await createConfirmedUser('grok-short')
    try {
      const { error } = await user.client.rpc('set_grok_api_key', { api_key: 'short' })
      expect(error?.message).toMatch(/too short/i)
    } finally {
      await deleteUser(user.id)
    }
  })

  it('should reject Grok RPCs without a session', async () => {
    const anon = anonClient()
    const { error: setError } = await anon.rpc('set_grok_api_key', {
      api_key: 'xai-unauthenticated-key',
    })
    expect(setError).toBeTruthy()

    const { error: statusError } = await anon.rpc('grok_api_key_status')
    expect(statusError).toBeTruthy()
  })
})
