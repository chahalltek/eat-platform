/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

import { POST } from './route';
import { UPLOAD_STORAGE_DIR, sanitizeExtractedText } from '@/lib/uploads';

const pdfFixture = path.join(process.cwd(), 'src/lib/uploads/__fixtures__/sample.pdf');
const docxFixture = path.join(process.cwd(), 'src/lib/uploads/__fixtures__/sample.docx');

async function readFixture(filePath: string) {
  return fs.readFile(filePath);
}

describe('POST /api/upload/resume', () => {
  beforeEach(async () => {
    await fs.rm(UPLOAD_STORAGE_DIR, { recursive: true, force: true });
  });

  it('extracts text from a PDF and stores the blob reference', async () => {
    const buffer = await readFixture(pdfFixture);
    const file = new File([buffer], 'resume.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload/resume', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.text).toContain('Sample PDF Resume');
    expect(payload.blobPath).toBeTypeOf('string');

    const saved = await fs.readFile(payload.blobPath);
    expect(saved.byteLength).toBe(buffer.byteLength);
  });

  it('extracts and sanitizes text from DOCX files', async () => {
    const buffer = await readFixture(docxFixture);
    const file = new File([buffer], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload/resume', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.text).toContain('Hello DOCX Resume Key Skills: JavaScript & Python');
    expect(payload.text).not.toContain('<script>');
    expect(payload.text).toContain("alert('xss')");
  });

  it('rejects unsupported files', async () => {
    const buffer = Buffer.from('plain text');
    const file = new File([buffer], 'notes.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload/resume', {
      method: 'POST',
      body: formData,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Unsupported file type');
    expect(warnSpy).toHaveBeenCalledWith('Resume upload validation failed', {
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      reason: 'Unsupported file type',
    });
    warnSpy.mockRestore();
  });

  it('rejects empty files before attempting extraction', async () => {
    const buffer = Buffer.from('');
    const file = new File([buffer], 'empty.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const request = new Request('http://localhost/api/upload/resume', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Uploaded file is empty');
    expect(warnSpy).toHaveBeenCalledWith('Resume upload validation failed', {
      fileName: 'empty.pdf',
      reason: 'Empty file',
    });

    warnSpy.mockRestore();
  });

  it('rejects files that exceed the upload size limit', async () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');
    const file = new File([buffer], 'big.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const request = new Request('http://localhost/api/upload/resume', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload.error).toBe('Uploaded file exceeds size limits');
    expect(warnSpy).toHaveBeenCalledWith('Resume upload validation failed', {
      fileName: 'big.pdf',
      reason: 'File too large',
      size: buffer.byteLength,
    });

    warnSpy.mockRestore();
  });

  it('sanitizes suspicious content to prevent injection', () => {
    const raw = 'Normal text <script>alert(1)</script> more text';
    const sanitized = sanitizeExtractedText(raw);

    expect(sanitized).toBe('Normal text alert(1) more text');
  });
});
