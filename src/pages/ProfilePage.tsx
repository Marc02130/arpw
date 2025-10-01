import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { ProfileForm } from '../types'

const ProfilePage: React.FC = () => {
  const [form, setForm] = useState<ProfileForm>({
    full_name: '',
    grok_api_key: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('user_profile')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile:', error)
          setMessage({ type: 'error', text: 'Error loading profile' })
        } else if (data) {
          setForm({
            full_name: data.full_name || '',
            grok_api_key: '', // Don't show the actual key for security
          })
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setMessage({ type: 'error', text: 'Error loading profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage({ type: 'error', text: 'User not authenticated' })
        return
      }

      const updateData: any = {
        full_name: form.full_name,
        updated_at: new Date().toISOString(),
      }

      // Only update API key if provided
      if (form.grok_api_key?.trim()) {
        updateData.grok_api_key = form.grok_api_key.trim()
      }

      const { error } = await supabase
        .from('user_profile')
        .upsert({
          user_id: user.id,
          email: user.email || '',
          ...updateData,
        })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully' })
        // Clear the API key field after successful save
        setForm(prev => ({ ...prev, grok_api_key: '' }))
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      setMessage({ type: 'error', text: 'Error saving profile' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account information and API keys.
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="card">
          <form onSubmit={handleSave} className="space-y-6">
            {message && (
              <div className={`p-4 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="full_name"
                type="text"
                value={form.full_name}
                onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                className="input-field"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label htmlFor="grok_api_key" className="block text-sm font-medium text-gray-700 mb-2">
                Grok API Key
              </label>
              <input
                id="grok_api_key"
                type="password"
                value={form.grok_api_key}
                onChange={(e) => setForm(prev => ({ ...prev, grok_api_key: e.target.value }))}
                className="input-field"
                placeholder="Enter your Grok API key (optional)"
              />
              <p className="mt-1 text-sm text-gray-500">
                Your API key is encrypted and stored securely. Leave blank to keep current key.
              </p>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={fetchProfile}
                className="btn-secondary"
                disabled={saving}
              >
                Reset
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="card mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500">Account Type:</span>
              <span className="ml-2 text-sm text-gray-900">Free Tier</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Storage Used:</span>
              <span className="ml-2 text-sm text-gray-900">0 MB / 1 GB</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Papers Generated:</span>
              <span className="ml-2 text-sm text-gray-900">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
