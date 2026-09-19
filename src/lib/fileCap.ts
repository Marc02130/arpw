export const REFERENCE_FILE_CAP = 500
export const EXAMPLE_FILE_CAP = 10
/** Max files in one drop or file-picker selection (also the ingest concurrency). */
export const UPLOAD_BATCH_SIZE = 10

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

export const uploadBatchError = (batchSize: number): string | null => {
  if (batchSize > UPLOAD_BATCH_SIZE) {
    return `Upload at most ${UPLOAD_BATCH_SIZE} files at a time.`
  }
  return null
}
