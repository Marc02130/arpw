import React, { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthAlert from './AuthAlert'
import AuthShell from './AuthShell'

const VerifyEmail: React.FC = () => {
  const location = useLocation()
  const { user, resendConfirmation, loading, error, clearError } = useAuth()
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const email = useMemo(() => {
    const fromState = (location.state as { email?: string } | null)?.email
    return fromState || user?.email || ''
  }, [location.state, user])

  const handleResend = async () => {
    if (!email) return
    clearError()
    setIsSubmitting(true)
    const result = await resendConfirmation(email)
    setIsSubmitting(false)
    if (result.success) {
      setSent(true)
    }
  }

  return (
    <AuthShell title="Check your email" subtitle="Confirm your address before you can use the app">
      <div className="space-y-6">
        {error && <AuthAlert>{error}</AuthAlert>}
        {sent && (
          <AuthAlert tone="success">
            Confirmation email sent{email ? ` to ${email}` : ''}. Locally, open the mailbox at
            http://127.0.0.1:54324.
          </AuthAlert>
        )}

        <p className="text-sm text-gray-700 text-center">
          We sent a verification link{email ? ` to ${email}` : ''}. Click it to activate your
          account. Until then you cannot sign in.
        </p>
        <p className="text-sm text-gray-500 text-center">
          Local development: mail is caught by Inbucket at{' '}
          <a
            href="http://127.0.0.1:54324"
            className="text-primary-600 hover:text-primary-500"
            target="_blank"
            rel="noreferrer"
          >
            http://127.0.0.1:54324
          </a>
          .
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={!email || isSubmitting || loading}
          className="btn-secondary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending...' : 'Resend confirmation email'}
        </button>

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary-600 hover:text-primary-500">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}

export default VerifyEmail
