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
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const kind = detectFileKind(file.name, file.type);

  if (!kind) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  let buffer: Buffer;

  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (error) {
    return NextResponse.json({ error: 'Unable to read uploaded file' }, { status: 400 });
  }

  let rawText: string;

  try {
    rawText = await extractTextFromBuffer(buffer, kind);
  } catch (error) {
    console.error('Failed to parse uploaded file', error);
    return NextResponse.json({ error: 'Unable to extract text from file' }, { status: 422 });
  }

  const sanitizedText = sanitizeExtractedText(rawText);
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
