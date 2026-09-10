import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export const TEST_PASSWORD = 'test-pass-123'

export const supabaseUrl = (): string =>
  process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'

export const anonKey = (): string => process.env.VITE_SUPABASE_ANON_KEY ?? LOCAL_ANON

export const serviceRoleKey = (): string => {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = supabaseUrl()
  if (url.includes('127.0.0.1') || url.includes('localhost')) return LOCAL_SERVICE_ROLE
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for integration tests')
}

export const anonClient = (): SupabaseClient => createClient(supabaseUrl(), anonKey())

export const adminClient = (): SupabaseClient =>
  createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export const userClient = (accessToken: string): SupabaseClient => {
  const client = createClient(supabaseUrl(), anonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  return client
}

export async function assertSupabaseUp(): Promise<void> {
  const response = await fetch(`${supabaseUrl()}/auth/v1/health`, {
    headers: { apikey: anonKey() },
  })
  if (!response.ok) {
    throw new Error(
      `Local Supabase is not running at ${supabaseUrl()} (HTTP ${response.status}). Start with the installed supabase CLI, not npx.`
    )
  }
}

export async function storageIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/storage/v1/bucket`, {
      headers: {
        apikey: serviceRoleKey(),
        Authorization: `Bearer ${serviceRoleKey()}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

export async function ingestFunctionIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/functions/v1/upload_processor`, {
      method: 'OPTIONS',
      headers: { apikey: anonKey() },
    })
    return response.ok || response.status === 204
  } catch {
    return false
  }
}

export async function outlineFunctionIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/functions/v1/generate_outline`, {
      method: 'OPTIONS',
      headers: { apikey: anonKey() },
    })
    return response.ok || response.status === 204
  } catch {
    return false
  }
}

export async function generateFunctionIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/functions/v1/generate_paper`, {
      method: 'OPTIONS',
      headers: { apikey: anonKey() },
    })
    return response.ok || response.status === 204
  } catch {
    return false
  }
}

export async function embedFunctionIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/functions/v1/embed_text`, {
      method: 'OPTIONS',
      headers: { apikey: anonKey() },
    })
    return response.ok || response.status === 204
  } catch {
    return false
  }
}

export async function interrogateFunctionIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/functions/v1/interrogate_corpus`, {
      method: 'OPTIONS',
      headers: { apikey: anonKey() },
    })
    return response.ok || response.status === 204
  } catch {
    return false
  }
}

export async function createConfirmedUser(
  label: string
): Promise<{ id: string; email: string; accessToken: string; client: SupabaseClient }> {
  const email = `it-${label}-${crypto.randomUUID()}@example.com`
  const anon = anonClient()
  const { data, error } = await anon.auth.signUp({ email, password: TEST_PASSWORD })
  if (error || !data.user) {
    throw new Error(`signUp failed: ${error?.message ?? 'no user'}`)
  }
  const id = data.user.id
  const admin = adminClient()
  const { error: confirmError } = await admin.auth.admin.updateUserById(id, {
    email_confirm: true,
  })
  if (confirmError) {
    throw new Error(`confirm failed: ${confirmError.message}`)
  }
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (signInError || !session.session) {
    throw new Error(`signIn failed: ${signInError?.message ?? 'no session'}`)
  }
  return {
    id,
    email,
    accessToken: session.session.access_token,
    client: userClient(session.session.access_token),
  }
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(id)
  if (error) {
    console.warn(`Could not delete test user ${id}: ${error.message}`)
  }
}
