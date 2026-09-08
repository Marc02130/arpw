import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { GrokKeyStatus, UserProfile } from '../types'
import { validateGrokApiKeyInput } from '../lib/validateAuth'

export type AuthResult = {
  success: boolean
  error?: string
  needsEmailConfirmation?: boolean
}

const emptyGrokKey: GrokKeyStatus = { set: false, last4: null }

interface AuthState {
  user: User | null
  userProfile: UserProfile | null
  session: Session | null
  loading: boolean
  error: string | null
  isRecovery: boolean
  grokKey: GrokKeyStatus
}

interface AuthActions {
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<AuthResult>
  setGrokApiKey: (apiKey: string) => Promise<AuthResult>
  clearGrokApiKey: () => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  clearError: () => void
}

const appOrigin = () => window.location.origin

const isUnconfirmedError = (message: string) =>
  /email not confirmed|confirm your email|email_not_confirmed/i.test(message)

type AuthContextValue = AuthState & AuthActions & { isEmailConfirmed: boolean }

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    userProfile: null,
    session: null,
    loading: true,
    error: null,
    isRecovery: false,
    grokKey: emptyGrokKey,
  })

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }, [])

  const fetchGrokKeyStatus = useCallback(async (): Promise<GrokKeyStatus> => {
    try {
      const { data, error } = await supabase.rpc('grok_api_key_status')
      if (error || !data) {
        return emptyGrokKey
      }
      const status = data as GrokKeyStatus
      return { set: Boolean(status.set), last4: status.last4 ?? null }
    } catch {
      return emptyGrokKey
    }
  }, [])

  const ensureUserProfile = useCallback(
    async (user: User): Promise<UserProfile | null> => {
      const existing = await fetchUserProfile(user.id)
      if (existing) return existing

      const fullName =
        (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
        null

      const { error } = await supabase.from('user_profile').insert({
        user_id: user.id,
        email: user.email ?? '',
        full_name: fullName,
      })

      if (error && error.code !== '23505') {
        console.error('Error ensuring user profile:', error)
      }

      return fetchUserProfile(user.id)
    },
    [fetchUserProfile]
  )

  useEffect(() => {
    let mounted = true

    const applySession = async (session: Session | null) => {
      if (!session?.user) {
        if (mounted) {
          setState({
            user: null,
            userProfile: null,
            session: null,
            loading: false,
            error: null,
            isRecovery: false,
            grokKey: emptyGrokKey,
          })
        }
        return
      }

      const userProfile = session.user.email_confirmed_at
        ? await ensureUserProfile(session.user)
        : await fetchUserProfile(session.user.id)
      const grokKey = session.user.email_confirmed_at
        ? await fetchGrokKeyStatus()
        : emptyGrokKey

      if (mounted) {
        setState((prev) => ({
          ...prev,
          user: session.user,
          userProfile,
          session,
          loading: false,
          error: null,
          isRecovery: prev.isRecovery || window.location.pathname === '/reset-password',
          grokKey,
        }))
      }
    }

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setState((prev) => ({ ...prev, loading: false, error: error.message }))
          }
          return
        }

        await applySession(session)
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Failed to initialize authentication',
          }))
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY') {
        setState((prev) => ({ ...prev, isRecovery: true }))
      }
      if (event === 'SIGNED_OUT') {
        setState((prev) => ({ ...prev, isRecovery: false }))
      }

      void applySession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [ensureUserProfile, fetchUserProfile, fetchGrokKeyStatus])

  const signUp = useCallback(async (email: string, password: string, fullName?: string): Promise<AuthResult> => {
    try {
      setState((prev) => ({ ...prev, error: null }))

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${appOrigin()}/login`,
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      if (!data.user) {
        setState((prev) => ({ ...prev, loading: false, error: 'Sign up failed' }))
        return { success: false, error: 'Sign up failed' }
      }

      const needsEmailConfirmation = !data.session || !data.user.email_confirmed_at
      setState((prev) => ({ ...prev, loading: false, error: null }))
      return { success: true, needsEmailConfirmation }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed'
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        setState((prev) => ({ ...prev, error: null }))

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          const needsEmailConfirmation = isUnconfirmedError(error.message)
          setState((prev) => ({ ...prev, loading: false, error: error.message }))
          return { success: false, error: error.message, needsEmailConfirmation }
        }

        if (!data.user) {
          setState((prev) => ({ ...prev, loading: false, error: 'Sign in failed' }))
          return { success: false, error: 'Sign in failed' }
        }

        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut()
          const message = 'Please verify your email before signing in.'
          setState({
            user: null,
            userProfile: null,
            session: null,
            loading: false,
            error: message,
            isRecovery: false,
            grokKey: emptyGrokKey,
          })
          return { success: false, error: message, needsEmailConfirmation: true }
        }

        const userProfile = await ensureUserProfile(data.user)
        const grokKey = await fetchGrokKeyStatus()
        setState({
          user: data.user,
          userProfile,
          session: data.session,
          loading: false,
          error: null,
          isRecovery: false,
          grokKey,
        })
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
        setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
        return { success: false, error: errorMessage }
      }
    },
    [ensureUserProfile, fetchGrokKeyStatus]
  )

  const signOut = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }))

      const { error } = await supabase.auth.signOut()

      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }))
        return
      }

      setState({
        user: null,
        userProfile: null,
        session: null,
        loading: false,
        error: null,
        isRecovery: false,
        grokKey: emptyGrokKey,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed'
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
    }
  }, [])

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>): Promise<AuthResult> => {
      if (!state.user) {
        return { success: false, error: 'No authenticated user' }
      }

      try {
        setState((prev) => ({ ...prev, error: null }))

        const payload: { full_name?: string | null; email?: string; updated_at: string } = {
          updated_at: new Date().toISOString(),
        }
        if (updates.full_name !== undefined) payload.full_name = updates.full_name
        if (updates.email !== undefined) payload.email = updates.email

        const { error } = await supabase
          .from('user_profile')
          .update(payload)
          .eq('user_id', state.user.id)

        if (error) {
          setState((prev) => ({ ...prev, loading: false, error: error.message }))
          return { success: false, error: error.message }
        }

        const updatedProfile = await fetchUserProfile(state.user.id)
        setState((prev) => ({
          ...prev,
          userProfile: updatedProfile,
          loading: false,
          error: null,
        }))

        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Profile update failed'
        setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
        return { success: false, error: errorMessage }
      }
    },
    [state.user, fetchUserProfile]
  )

  const setGrokApiKey = useCallback(async (apiKey: string): Promise<AuthResult> => {
    try {
      const keyError = validateGrokApiKeyInput(apiKey)
      if (keyError) {
        setState((prev) => ({ ...prev, error: keyError }))
        return { success: false, error: keyError }
      }
      setState((prev) => ({ ...prev, error: null }))
      const { data, error } = await supabase.rpc('set_grok_api_key', { api_key: apiKey })
      if (error) {
        setState((prev) => ({ ...prev, error: error.message }))
        return { success: false, error: error.message }
      }
      const status = (data as GrokKeyStatus) ?? emptyGrokKey
      setState((prev) => ({
        ...prev,
        grokKey: { set: Boolean(status.set), last4: status.last4 ?? null },
      }))
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not save API key'
      setState((prev) => ({ ...prev, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  const clearGrokApiKey = useCallback(async (): Promise<AuthResult> => {
    try {
      setState((prev) => ({ ...prev, error: null }))
      const { error } = await supabase.rpc('clear_grok_api_key')
      if (error) {
        setState((prev) => ({ ...prev, error: error.message }))
        return { success: false, error: error.message }
      }
      setState((prev) => ({ ...prev, grokKey: emptyGrokKey }))
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not remove API key'
      setState((prev) => ({ ...prev, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      setState((prev) => ({ ...prev, error: null }))

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appOrigin()}/reset-password`,
      })

      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      setState((prev) => ({ ...prev, loading: false, error: null }))
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed'
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    try {
      setState((prev) => ({ ...prev, error: null }))

      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      setState((prev) => ({ ...prev, loading: false, error: null, isRecovery: false }))
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password update failed'
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  const resendConfirmation = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      setState((prev) => ({ ...prev, error: null }))

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${appOrigin()}/login`,
        },
      })

      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      setState((prev) => ({ ...prev, loading: false, error: null }))
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not resend confirmation'
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  const value: AuthContextValue = {
    ...state,
    isEmailConfirmed: Boolean(state.user?.email_confirmed_at),
    signUp,
    signIn,
    signOut,
    updateProfile,
    setGrokApiKey,
    clearGrokApiKey,
    resetPassword,
    updatePassword,
    resendConfirmation,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
