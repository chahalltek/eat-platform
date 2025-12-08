import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export type SupportedFileKind = 'pdf' | 'docx';

export const UPLOAD_STORAGE_DIR = path.join(process.cwd(), 'tmp', 'uploads');

const MIME_KIND_MAP: Record<string, SupportedFileKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const EXTENSION_KIND_MAP: Record<string, SupportedFileKind> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
};

export function detectFileKind(filename: string, mimeType?: string | null): SupportedFileKind | null {
  const normalizedMime = mimeType?.toLowerCase();

  if (normalizedMime && MIME_KIND_MAP[normalizedMime]) {
    return MIME_KIND_MAP[normalizedMime];
  }

  const extension = path.extname(filename || '').toLowerCase();
  return EXTENSION_KIND_MAP[extension] ?? null;
}

function normalizeArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  const { text } = await parser.getText();
  await parser.destroy();

  return text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: normalizeArrayBuffer(buffer) });
  return value;
}

export async function extractTextFromBuffer(buffer: Buffer, kind: SupportedFileKind): Promise<string> {
  if (!buffer.length) {
    throw new Error('File is empty');
  }

  if (kind === 'pdf') {
    return extractPdfText(buffer);
  }

  if (kind === 'docx') {
    return extractDocxText(buffer);
  }

  throw new Error('Unsupported file kind');
}

export function sanitizeExtractedText(text: string): string {
  const withoutControlChars = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  const withoutTags = withoutControlChars.replace(/<[^>]*>/g, ' ');
  const collapsedWhitespace = withoutTags.replace(/\s+/g, ' ').trim();

  return collapsedWhitespace;
}

export async function persistUploadedFile(buffer: Buffer, kind: SupportedFileKind): Promise<string> {
  await fs.mkdir(UPLOAD_STORAGE_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.${kind}`;
  const filepath = path.join(UPLOAD_STORAGE_DIR, filename);

  await fs.writeFile(filepath, buffer);

  return filepath;
}
