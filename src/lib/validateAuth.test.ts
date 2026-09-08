import { describe, expect, it } from 'vitest'
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateGrokApiKeyInput,
  validateLoginFields,
  validatePassword,
} from './validateAuth'

describe('validateEmail', () => {
  it('should require an email', () => {
    expect(validateEmail('')).toBe('Email is required')
    expect(validateEmail('   ')).toBe('Email is required')
  })

  it('should reject a value without @', () => {
    expect(validateEmail('not-an-email')).toBe('Please enter a valid email address')
  })

  it('should accept a simple address', () => {
    expect(validateEmail('user@example.com')).toBeUndefined()
  })
})

describe('validatePassword', () => {
  it('should require a password of at least 6 characters', () => {
    expect(validatePassword('')).toBe('Password is required')
    expect(validatePassword('12345')).toBe('Password must be at least 6 characters')
    expect(validatePassword('123456')).toBeUndefined()
  })
})

describe('validateConfirmPassword', () => {
  it('should require a matching confirmation', () => {
    expect(validateConfirmPassword('secret1', '')).toBe('Please confirm your password')
    expect(validateConfirmPassword('secret1', 'secret2')).toBe('Passwords do not match')
    expect(validateConfirmPassword('secret1', 'secret1')).toBeUndefined()
  })
})

describe('validateFullName', () => {
  it('should require at least two characters', () => {
    expect(validateFullName('')).toBe('Full name is required')
    expect(validateFullName('A')).toBe('Full name must be at least 2 characters')
    expect(validateFullName('Ab')).toBeUndefined()
  })
})

describe('validateLoginFields', () => {
  const base = {
    email: 'a@b.com',
    password: 'secret1',
    confirmPassword: '',
    fullName: '',
  }

  it('should skip name and confirm on sign in', () => {
    expect(validateLoginFields(base, false)).toEqual({})
  })

  it('should require name and confirm on sign up', () => {
    const errors = validateLoginFields(base, true)
    expect(errors.fullName).toBe('Full name is required')
    expect(errors.confirmPassword).toBe('Please confirm your password')
  })
})

describe('validateGrokApiKeyInput', () => {
  it('should allow a blank key (keep existing)', () => {
    expect(validateGrokApiKeyInput('')).toBeUndefined()
    expect(validateGrokApiKeyInput('   ')).toBeUndefined()
  })

  it('should reject a short pasted key', () => {
    expect(validateGrokApiKeyInput('short')).toBe('API key appears to be too short')
  })

  it('should reject a filesystem path used as a key', () => {
    expect(validateGrokApiKeyInput('/Users/marcbreneiser/Code/arpw/.env')).toBe(
      'API key looks like a file path, not an xAI key'
    )
    expect(validateGrokApiKeyInput('./.env')).toBe('API key looks like a file path, not an xAI key')
    expect(validateGrokApiKeyInput('C:\\secrets\\xai.key')).toBe(
      'API key looks like a file path, not an xAI key'
    )
  })

  it('should reject a key that does not start with xai-', () => {
    expect(validateGrokApiKeyInput('sk-not-an-xai-key-value')).toBe('API key must start with xai-')
  })

  it('should accept a key of 10 or more characters that starts with xai-', () => {
    expect(validateGrokApiKeyInput('xai-abcdefg')).toBeUndefined()
  })
})
