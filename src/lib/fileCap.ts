export const REFERENCE_FILE_CAP = 500
export const EXAMPLE_FILE_CAP = 10

export const remainingSlots = (maxFiles: number, existing: number): number =>
  maxFiles - existing

export const uploadCapError = (
  maxFiles: number,
  existing: number,
  batchSize: number
): string | null => {
  const remaining = remainingSlots(maxFiles, existing)
  if (remaining <= 0) {
    return `File cap reached (${maxFiles}). Delete a file before uploading more.`
  }
  if (batchSize > remaining) {
    return `Too many files. You have ${existing} of ${maxFiles} and can add ${remaining} more.`
  }
  return null
}
