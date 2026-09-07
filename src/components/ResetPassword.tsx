import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { validateConfirmPassword, validatePassword } from '../lib/validateAuth'
import AuthAlert from './AuthAlert'
import AuthShell from './AuthShell'

const ResetPassword: React.FC = () => {
  const navigate = useNavigate()
  const { isRecovery, user, loading, error, clearError, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const ready = isRecovery || Boolean(user)

  const validate = () => {
    const next: { password?: string; confirmPassword?: string } = {}
    const passwordError = validatePassword(password)
    if (passwordError) next.password = passwordError
    const confirmError = validateConfirmPassword(password, confirmPassword)
    if (confirmError) next.confirmPassword = confirmError
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    if (!validate()) return

    setIsSubmitting(true)
    const result = await updatePassword(password)
    setIsSubmitting(false)
    if (result.success) {
      navigate('/dashboard', { replace: true })
    }
  }

  if (loading && !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!ready) {
    return (
      <AuthShell title="Reset link invalid" subtitle="Request a new password reset email">
        <AuthAlert>This reset link is invalid or has expired.</AuthAlert>
        <Link
          to="/forgot-password"
          className="block text-center text-sm text-primary-600 hover:text-primary-500"
        >
          Request a new reset link
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Then you can sign in as usual">
      <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
        {error && <AuthAlert>{error}</AuthAlert>}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            New password <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`input-field mt-1 ${fieldErrors.password ? 'border-red-300' : ''}`}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm password <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`input-field mt-1 ${fieldErrors.confirmPassword ? 'border-red-300' : ''}`}
          />
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || loading}
          className="btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}

export default ResetPassword
