import { useState, useEffect, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { UserProfile } from '../types'

interface AuthState {
  user: User | null
  userProfile: UserProfile | null
  session: Session | null
  loading: boolean
  error: string | null
}

interface AuthActions {
  signUp: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>
  clearError: () => void
}

export const useAuth = (): AuthState & AuthActions => {
  const [state, setState] = useState<AuthState>({
    user: null,
    userProfile: null,
    session: null,
    loading: true,
    error: null,
  })

  // Fetch user profile from database
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profile')
        .select('*')
        .eq('user_id', userId)
        .single()

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

  // Create user profile entry
  const createUserProfile = useCallback(async (userId: string, email: string, fullName?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('user_profile')
        .insert({
          user_id: userId,
          email,
          full_name: fullName || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (error) {
        console.error('Error creating user profile:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error creating user profile:', error)
      return false
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setState(prev => ({ ...prev, loading: false, error: error.message }))
          }
          return
        }

        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user.id)
          
          if (mounted) {
            setState({
              user: session.user,
              userProfile,
              session,
              loading: false,
              error: null,
            })
          }
        } else {
          if (mounted) {
            setState({
              user: null,
              userProfile: null,
              session: null,
              loading: false,
              error: null,
            })
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setState(prev => ({ ...prev, loading: false, error: 'Failed to initialize authentication' }))
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      try {
        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user.id)
          setState({
            user: session.user,
            userProfile,
            session,
            loading: false,
            error: null,
          })
        } else {
          setState({
            user: null,
            userProfile: null,
            session: null,
            loading: false,
            error: null,
          })
        }
      } catch (error) {
        console.error('Error handling auth state change:', error)
        setState(prev => ({ ...prev, loading: false, error: 'Authentication error' }))
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchUserProfile])

  // Sign up function
  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      if (data.user) {
        // Create user profile entry
        const profileCreated = await createUserProfile(data.user.id, email, fullName)
        
        if (!profileCreated) {
          setState(prev => ({ ...prev, loading: false, error: 'Failed to create user profile' }))
          return { success: false, error: 'Failed to create user profile' }
        }

        setState(prev => ({ ...prev, loading: false, error: null }))
        return { success: true }
      }

      setState(prev => ({ ...prev, loading: false, error: 'Sign up failed' }))
      return { success: false, error: 'Sign up failed' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed'
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [createUserProfile])

  // Sign in function
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      if (data.user) {
        const userProfile = await fetchUserProfile(data.user.id)
        setState({
          user: data.user,
          userProfile,
          session: data.session,
          loading: false,
          error: null,
        })
        return { success: true }
      }

      setState(prev => ({ ...prev, loading: false, error: 'Sign in failed' }))
      return { success: false, error: 'Sign in failed' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [fetchUserProfile])

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }))
        return
      }

      setState({
        user: null,
        userProfile: null,
        session: null,
        loading: false,
        error: null,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed'
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
    }
  }, [])

  // Update profile function
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!state.user) {
      return { success: false, error: 'No authenticated user' }
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const { error } = await supabase
        .from('user_profile')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', state.user.id)

      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      // Refresh user profile
      const updatedProfile = await fetchUserProfile(state.user.id)
      setState(prev => ({ ...prev, userProfile: updatedProfile, loading: false, error: null }))
      
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile update failed'
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [state.user, fetchUserProfile])

  // Clear error function
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    updateProfile,
    clearError,
  }
}
