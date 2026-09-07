import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { User } from '@supabase/supabase-js'
import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
import VerifyEmail from './components/VerifyEmail'
import HomePage from './pages/HomePage'
import PaperGenerationPage from './pages/PaperGenerationPage'
import Profile from './components/Profile'
import LibraryPage from './pages/LibraryPage'
import Layout from './components/Layout'
import { UserProfile } from './types'

function displayProfile(user: User, userProfile: UserProfile | null): UserProfile {
  if (userProfile) return userProfile
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null
  return {
    user_id: user.id,
    email: user.email ?? '',
    full_name: fullName,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  }
}

function App() {
  const { user, userProfile, loading, isRecovery, isEmailConfirmed } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const canUseApp = Boolean(user && isEmailConfirmed && !isRecovery)

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route
            path="/login"
            element={canUseApp ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          <Route
            path="/forgot-password"
            element={canUseApp ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/verify-email"
            element={canUseApp ? <Navigate to="/dashboard" replace /> : <VerifyEmail />}
          />

          <Route
            path="/"
            element={
              isRecovery ? (
                <Navigate to="/reset-password" replace />
              ) : user && !isEmailConfirmed ? (
                <Navigate to="/verify-email" replace />
              ) : canUseApp && user ? (
                <Layout user={displayProfile(user, userProfile)} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<HomePage />} />
            <Route path="generate/*" element={<PaperGenerationPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="library" element={<LibraryPage />} />
          </Route>

          <Route
            path="*"
            element={
              canUseApp ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
