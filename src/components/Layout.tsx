import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { UserProfile, NavItem } from '../types'
import { useAuth } from '../hooks/useAuth'
import { MAIN_CONTENT_ID, SKIP_TO_CONTENT_HREF } from '../lib/keyboardFlows'

interface LayoutProps {
  user: UserProfile
}

const Layout: React.FC<LayoutProps> = ({ user }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const navigation: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Paper generation', href: '/generate', icon: '✍️' },
    { name: 'Library', href: '/library', icon: '📚' },
    { name: 'Profile', href: '/profile', icon: '👤' },
  ]

  const navActive = (href: string) =>
    href === '/generate'
      ? location.pathname.startsWith('/generate')
      : location.pathname === href

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href={SKIP_TO_CONTENT_HREF}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:rounded-md focus:bg-white focus:text-primary-700 focus:ring-2 focus:ring-primary-500"
      >
        Skip to main content
      </a>
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">
                  AI Research Paper Writer
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`${
                      navActive(item.href)
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {user.full_name || user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main id={MAIN_CONTENT_ID} className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
