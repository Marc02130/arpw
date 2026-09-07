/** Synthetic NFR-7 corpus. Not a real paper; no PII. */

export const NFR7_PROBE = 'nfr7probe'

export const NFR7_TEXT = [
  'Methods',
  `We indexed a private reference corpus and retrieved passages for a known query token ${NFR7_PROBE}.`,
  'Each uploaded file was parsed, split into overlapping character chunks, and stored as 384-dimension hash embeddings.',
  'Results',
  `A retrieval hit on ${NFR7_PROBE} must return a chunk from this fixture, not an unrelated document.`,
  'Generation must refuse citation ids that were not in the retrieved set.',
  'This paragraph exists so the fixture is longer than the minimum ingest chunk size used by upload_processor.',
  'Additional methods detail: sampling, inclusion criteria, and how section labels were taken from the first line of each chunk.',
  'Additional results detail: overlap with the probe token, embedding dimension, and that empty files are rejected before embed.',
].join('\n\n')

const pdfEscape = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const encoder = new TextEncoder()

export const buildFixturePdf = (text = NFR7_TEXT): Uint8Array => {
  const lines = text.split('\n')
  const ops = [
    'BT',
    '/F1 12 Tf',
    '72 720 Td',
    ...lines.flatMap((line, index) =>
      index === 0 ? [`(${pdfEscape(line)}) Tj`] : ['0 -14 Td', `(${pdfEscape(line)}) Tj`]
    ),
    'ET',
  ].join('\n')
  const stream = encoder.encode(ops)

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    '',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]

  const content =
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n` +
    ops +
    '\nendstream\nendobj\n'
  objects[3] = content

  let body = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) {
    offsets.push(encoder.encode(body).length)
    body += object
  }
  const xrefStart = encoder.encode(body).length
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ']
  for (let i = 1; i <= objects.length; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n `)
  }
  body += xrefLines.join('\n') + '\n'
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return encoder.encode(body)
}

export const fixturePdfBytes = (): Uint8Array => buildFixturePdf()
