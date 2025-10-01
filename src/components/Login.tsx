import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LoginFormData {
  email: string
  password: string
  confirmPassword: string
  fullName: string
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { signIn, signUp, loading, error, clearError } = useAuth()
  
  const [isSignUp, setIsSignUp] = useState(false)
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  })
  const [validationErrors, setValidationErrors] = useState<Partial<LoginFormData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Clear errors when switching between login/signup
  useEffect(() => {
    clearError()
    setValidationErrors({})
  }, [isSignUp, clearError])

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && !error) {
      // This will be handled by the parent component
    }
  }, [loading, error])

  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {}

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    // Sign up specific validations
    if (isSignUp) {
      if (!formData.fullName.trim()) {
        errors.fullName = 'Full name is required'
      }

      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your password'
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear validation error for this field
    if (validationErrors[name as keyof LoginFormData]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    clearError()

    try {
      let result
      
      if (isSignUp) {
        result = await signUp(formData.email, formData.password, formData.fullName)
      } else {
        result = await signIn(formData.email, formData.password)
      }

      if (result.success) {
        // Redirect to dashboard on success
        navigate('/dashboard')
      }
      // Error handling is done in the hook
    } catch (error) {
      console.error('Authentication error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleMode = () => {
    setIsSignUp(!isSignUp)
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
    })
    setValidationErrors({})
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            AI Research Paper Writer
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Full Name (Sign up only) */}
            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={`input-field mt-1 ${validationErrors.fullName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  placeholder="Enter your full name"
                  aria-describedby={validationErrors.fullName ? 'fullName-error' : undefined}
                  aria-invalid={!!validationErrors.fullName}
                />
                {validationErrors.fullName && (
                  <p id="fullName-error" className="mt-1 text-sm text-red-600" role="alert">
                    {validationErrors.fullName}
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className={`input-field mt-1 ${validationErrors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="Enter your email"
                aria-describedby={validationErrors.email ? 'email-error' : undefined}
                aria-invalid={!!validationErrors.email}
              />
              {validationErrors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                value={formData.password}
                onChange={handleInputChange}
                className={`input-field mt-1 ${validationErrors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="Enter your password"
                aria-describedby={validationErrors.password ? 'password-error' : undefined}
                aria-invalid={!!validationErrors.password}
              />
              {validationErrors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.password}
                </p>
              )}
            </div>

            {/* Confirm Password (Sign up only) */}
            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`input-field mt-1 ${validationErrors.confirmPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  placeholder="Confirm your password"
                  aria-describedby={validationErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                  aria-invalid={!!validationErrors.confirmPassword}
                />
                {validationErrors.confirmPassword && (
                  <p id="confirmPassword-error" className="mt-1 text-sm text-red-600" role="alert">
                    {validationErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              aria-describedby="submit-status"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </span>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
            <div id="submit-status" className="sr-only" aria-live="polite">
              {isSubmitting ? 'Processing your request...' : 'Ready to submit'}
            </div>
          </div>

          {/* Toggle Mode */}
          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
              disabled={isSubmitting}
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        </form>

        {/* Accessibility Note */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            This form is designed to meet WCAG 2.1 AA accessibility standards.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
