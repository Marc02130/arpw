import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthAlert from './AuthAlert'
import AuthShell from './AuthShell'

const ForgotPassword: React.FC = () => {
  const { resetPassword, loading, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!email.trim()) {
      setEmailError('Email is required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    setEmailError(null)
    setIsSubmitting(true)
    const result = await resetPassword(email.trim())
    setIsSubmitting(false)
    if (result.success) {
      setSent(true)
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We will email you a reset link">
      {sent ? (
        <div className="space-y-6">
          <AuthAlert tone="success">
            If an account exists for {email}, a reset link is on its way. Locally, open the
            mailbox at http://127.0.0.1:54324.
          </AuthAlert>
          <Link to="/login" className="block text-center text-sm text-primary-600 hover:text-primary-500">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {error && <AuthAlert>{error}</AuthAlert>}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError(null)
              }}
              className={`input-field mt-1 ${emailError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
              placeholder="Enter your email"
              aria-invalid={!!emailError}
            />
            {emailError && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary-600 hover:text-primary-500">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  )
}

export default ForgotPassword
