import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import DashboardPage from './pages/DashboardPage'
import Profile from './components/Profile'
import LibraryPage from './pages/LibraryPage'
import Layout from './components/Layout'

function App() {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              user && userProfile ? <Navigate to="/dashboard" replace /> : <Login />
            } 
          />
          
          {/* Protected routes */}
          <Route 
            path="/" 
            element={
              user && userProfile ? <Layout user={userProfile} /> : <Navigate to="/login" replace />
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="library" element={<LibraryPage />} />
          </Route>
          
          {/* Catch all route */}
          <Route 
            path="*" 
            element={
              user && userProfile ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
            } 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
