import { NextResponse } from 'next/server';

import {
  UPLOAD_STORAGE_DIR,
  detectFileKind,
  extractTextFromBuffer,
  persistUploadedFile,
  sanitizeExtractedText,
  type SupportedFileKind,
} from '@/lib/uploads';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function logValidationFailure(reason: string, details?: Record<string, unknown>) {
  console.warn('Resume upload validation failed', { reason, ...details });
}

function buildMimeType(kind: SupportedFileKind): string {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    logValidationFailure('Invalid form payload', { error });
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');

  if (!(file instanceof File)) {
    logValidationFailure('Missing file field', { receivedKeys: Array.from(formData.keys()) });
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const kind = detectFileKind(file.name, file.type);

  if (!kind) {
    logValidationFailure('Unsupported file type', { fileName: file.name, mimeType: file.type });
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  let buffer: Buffer;

  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (error) {
    logValidationFailure('Unable to read file', { error, fileName: file.name });
    return NextResponse.json({ error: 'Unable to read uploaded file' }, { status: 400 });
  }

  if (!buffer.byteLength) {
    logValidationFailure('Empty file', { fileName: file.name });
    return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
  }

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    logValidationFailure('File too large', { fileName: file.name, size: buffer.byteLength });
    return NextResponse.json({ error: 'Uploaded file exceeds size limits' }, { status: 413 });
  }

  let rawText: string;

  try {
    rawText = await extractTextFromBuffer(buffer, kind);
  } catch (error) {
    console.error('Failed to parse uploaded file', error);
    return NextResponse.json({ error: 'Unable to extract text from file' }, { status: 422 });
  }

  const sanitizedText = sanitizeExtractedText(rawText);

  if (!sanitizedText) {
    logValidationFailure('No text content extracted', { fileName: file.name });
    return NextResponse.json({ error: 'Uploaded file did not contain readable text' }, { status: 422 });
  }

  const blobPath = await persistUploadedFile(buffer, kind);

  return NextResponse.json({
    fileName: file.name,
    mimeType: file.type || buildMimeType(kind),
    blobPath,
    storageRoot: UPLOAD_STORAGE_DIR,
    text: sanitizedText,
    length: sanitizedText.length,
  });
}
