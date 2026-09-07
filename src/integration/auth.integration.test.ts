import { beforeAll, describe, expect, it } from 'vitest'
import {
  TEST_PASSWORD,
  anonClient,
  assertSupabaseUp,
  createConfirmedUser,
  deleteUser,
} from './supabaseTest'

describe('auth integration', () => {
  beforeAll(assertSupabaseUp)

  it('should reject sign-in before email confirmation', async () => {
    const email = `it-unconfirmed-${crypto.randomUUID()}@example.com`
    const anon = anonClient()
    const { data, error } = await anon.auth.signUp({ email, password: TEST_PASSWORD })
    expect(error).toBeNull()
    expect(data.session).toBeNull()
    expect(data.user?.id).toBeTruthy()

    const { error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    })
    expect(signInError?.message).toMatch(/not confirmed/i)

    if (data.user) await deleteUser(data.user.id)
  })

  it('should sign in after admin confirm and have a profile row', async () => {
    const user = await createConfirmedUser('auth')
    try {
      const { data, error } = await user.client
        .from('user_profile')
        .select('user_id, email, full_name')
        .eq('user_id', user.id)
        .single()
      expect(error).toBeNull()
      expect(data?.user_id).toBe(user.id)
      expect(data?.email).toBe(user.email)
      expect(data && 'grok_api_key' in data).toBe(false)
    } finally {
      await deleteUser(user.id)
    }
  })

  it('should reject the wrong password', async () => {
    const user = await createConfirmedUser('auth-wrong')
    try {
      const { error } = await anonClient().auth.signInWithPassword({
        email: user.email,
        password: 'not-the-test-password',
      })
      expect(error).toBeTruthy()
    } finally {
      await deleteUser(user.id)
    }
  })

  it('should update the signed-in user\'s full name', async () => {
    const user = await createConfirmedUser('auth-name')
    try {
      const { error } = await user.client
        .from('user_profile')
        .update({ full_name: 'Ada Lovelace' })
        .eq('user_id', user.id)
      expect(error).toBeNull()

      const { data } = await user.client
        .from('user_profile')
        .select('full_name')
        .eq('user_id', user.id)
        .single()
      expect(data?.full_name).toBe('Ada Lovelace')
    } finally {
      await deleteUser(user.id)
    }
  })

  it('should accept a password-reset request for a confirmed user', async () => {
    const user = await createConfirmedUser('auth-reset')
    try {
      const { error } = await anonClient().auth.resetPasswordForEmail(user.email, {
        redirectTo: 'http://127.0.0.1:5173/reset-password',
      })
      expect(error).toBeNull()
    } finally {
      await deleteUser(user.id)
    }
  })

  it('should not let the service-role-only decrypt RPC run as a user', async () => {
    const user = await createConfirmedUser('auth-rpc')
    try {
      const { error } = await user.client.rpc('read_grok_api_key', { for_user: user.id })
      expect(error).toBeTruthy()
    } finally {
      await deleteUser(user.id)
    }
  })
})
