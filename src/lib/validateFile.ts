export const ACCEPTED_UPLOAD_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export type FileLike = {
  name: string
  size: number
}

export const fileExtension = (name: string): string => {
  const parts = name.split('.')
  if (parts.length < 2) return ''
  return `.${parts.pop()?.toLowerCase() ?? ''}`
}

export const validateUploadFile = (file: FileLike): string | null => {
  if (file.size <= 0) {
    return `File "${file.name}" is empty.`
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File "${file.name}" is too large. Maximum size is 10MB.`
  }

  const extension = fileExtension(file.name)
  if (!(ACCEPTED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension)) {
    return `File "${file.name}" has an unsupported format. Supported formats: PDF, DOCX, TXT.`
  }

  return null
}
