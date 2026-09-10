import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  GENERATE_BUTTON_ID,
  GENERATE_PROMPT_ID,
  LOGIN_FIELD_IDS,
  MAIN_CONTENT_ID,
  SKIP_TO_CONTENT_HREF,
  UPLOAD_ZONE_ROLE,
  isActivateKey,
} from './keyboardFlows'

const readSrc = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')

describe('keyboard primary flows (NFR-6)', () => {
  it('should treat Enter and Space as activate keys for the upload zone', () => {
    expect(isActivateKey('Enter')).toBe(true)
    expect(isActivateKey(' ')).toBe(true)
    expect(isActivateKey('Tab')).toBe(false)
    expect(isActivateKey('Escape')).toBe(false)
    expect(UPLOAD_ZONE_ROLE).toBe('button')
  })

  it('should name labeled login fields and generate controls', () => {
    expect(LOGIN_FIELD_IDS).toEqual(['email', 'password'])
    expect(GENERATE_PROMPT_ID).toBe('research-prompt')
    expect(GENERATE_BUTTON_ID).toBe('generate-paper')
    expect(SKIP_TO_CONTENT_HREF).toBe(`#${MAIN_CONTENT_ID}`)
  })

  it('should wire those controls in login, upload, and generate UI', () => {
    const login = readSrc('../components/Login.tsx')
    expect(login).toContain('htmlFor="email"')
    expect(login).toContain('htmlFor="password"')
    expect(login).toContain('type="submit"')

    const upload = readSrc('../components/UploadZone.tsx')
    expect(upload).toContain('isActivateKey')
    expect(upload).toContain('tabIndex={isUploading ? -1 : 0}')
    expect(upload).toContain('role={UPLOAD_ZONE_ROLE}')

    const generate = readSrc('../pages/PaperGenerationPage.tsx')
    expect(generate).toContain(`htmlFor={GENERATE_PROMPT_ID}`)
    expect(generate).toContain(`id={GENERATE_BUTTON_ID}`)
    expect(generate).toContain('type="button"')

    const layout = readSrc('../components/Layout.tsx')
    expect(layout).toContain('Skip to main content')
    expect(layout).toContain(`id={MAIN_CONTENT_ID}`)

    const library = readSrc('../pages/LibraryPage.tsx')
    expect(library).toContain('btn-danger')
    expect(library).toContain('aria-label={`Delete ${paper.title}`}')
    expect(library).toContain('aria-label={`Delete ${source.file_name}`}')
    expect(library).toContain('btn-primary')

    const dashboard = readSrc('../pages/HomePage.tsx')
    expect(dashboard).toContain('btn-danger')
    expect(dashboard).toContain('btn-primary')
    expect(dashboard).toContain('aria-label={`Delete ${paper.title}`}')
  })
})
