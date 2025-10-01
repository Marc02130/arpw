import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'

interface ProfileFormData {
  full_name: string
  grok_api_key: string
}

const Profile: React.FC = () => {
  const { user, userProfile, updateProfile, loading, error, clearError } = useAuth()
  
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: '',
    grok_api_key: '',
  })
  const [validationErrors, setValidationErrors] = useState<Partial<ProfileFormData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  // Initialize form data when user profile loads
  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        grok_api_key: '', // Don't show existing API key for security
      })
    }
  }, [userProfile])

  // Clear messages when form data changes
  useEffect(() => {
    if (successMessage) {
      setSuccessMessage(null)
    }
    if (error) {
      clearError()
    }
  }, [formData, successMessage, error, clearError])

  const validateForm = (): boolean => {
    const errors: Partial<ProfileFormData> = {}

    // Full name validation
    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required'
    } else if (formData.full_name.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters'
    }

    // API key validation (optional but if provided, should be reasonable length)
    if (formData.grok_api_key.trim() && formData.grok_api_key.trim().length < 10) {
      errors.grok_api_key = 'API key appears to be too short'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear validation error for this field
    if (validationErrors[name as keyof ProfileFormData]) {
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
    setSuccessMessage(null)

    try {
      // Prepare update data - only include fields that have changed
      const updateData: Partial<ProfileFormData> = {}
      
      if (formData.full_name !== (userProfile?.full_name || '')) {
        updateData.full_name = formData.full_name.trim()
      }
      
      // Only update API key if provided
      if (formData.grok_api_key.trim()) {
        updateData.grok_api_key = formData.grok_api_key.trim()
      }

      // If no changes, show message
      if (Object.keys(updateData).length === 0) {
        setSuccessMessage('No changes to save')
        setIsSubmitting(false)
        return
      }

      const result = await updateProfile(updateData)

      if (result.success) {
        setSuccessMessage('Profile updated successfully')
        // Clear the API key field after successful save for security
        setFormData(prev => ({ ...prev, grok_api_key: '' }))
      }
      // Error handling is done in the hook
    } catch (error) {
      console.error('Profile update error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        grok_api_key: '',
      })
    }
    setValidationErrors({})
    clearError()
    setSuccessMessage(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user || !userProfile) {
    return (
      <div className="card text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">👤</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Found</h3>
        <p className="text-gray-500">
          Unable to load your profile information.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account information and API keys.
        </p>
      </div>

      {/* Profile Form */}
      <div className="card">
        <form onSubmit={handleSubmit} noValidate>
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6" role="alert">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
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

          <div className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={userProfile.email}
                disabled
                className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
                aria-describedby="email-help"
              />
              <p id="email-help" className="mt-1 text-sm text-gray-500">
                Email address cannot be changed. Contact support if you need to update your email.
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                value={formData.full_name}
                onChange={handleInputChange}
                className={`input-field ${validationErrors.full_name ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="Enter your full name"
                aria-describedby={validationErrors.full_name ? 'full_name-error' : undefined}
                aria-invalid={!!validationErrors.full_name}
              />
              {validationErrors.full_name && (
                <p id="full_name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.full_name}
                </p>
              )}
            </div>

            {/* Grok API Key */}
            <div>
              <label htmlFor="grok_api_key" className="block text-sm font-medium text-gray-700 mb-2">
                Grok API Key
              </label>
              <div className="relative">
                <input
                  id="grok_api_key"
                  name="grok_api_key"
                  type={showApiKey ? 'text' : 'password'}
                  autoComplete="off"
                  value={formData.grok_api_key}
                  onChange={handleInputChange}
                  className={`input-field pr-10 ${validationErrors.grok_api_key ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  placeholder="Enter your Grok API key (optional)"
                  aria-describedby={validationErrors.grok_api_key ? 'grok_api_key-error' : 'grok_api_key-help'}
                  aria-invalid={!!validationErrors.grok_api_key}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {validationErrors.grok_api_key && (
                <p id="grok_api_key-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.grok_api_key}
                </p>
              )}
              <p id="grok_api_key-help" className="mt-1 text-sm text-gray-500">
                Your API key is encrypted and stored securely. Leave blank to keep your current key unchanged.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Reset
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              aria-describedby="submit-status"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
            <div id="submit-status" className="sr-only" aria-live="polite">
              {isSubmitting ? 'Saving your changes...' : 'Ready to save'}
            </div>
          </div>
        </form>
      </div>

      {/* Account Information */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">User ID:</span>
            <span className="text-sm text-gray-900 font-mono">{user.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Account Type:</span>
            <span className="text-sm text-gray-900">Free Tier</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Member Since:</span>
            <span className="text-sm text-gray-900">
              {new Date(userProfile.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Last Updated:</span>
            <span className="text-sm text-gray-900">
              {new Date(userProfile.updated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
