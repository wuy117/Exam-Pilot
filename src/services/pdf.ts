import type { KnowledgeDocumentStatus } from '../types';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  status: KnowledgeDocumentStatus;
  error?: string;
}

const maxPdfBytes = 25 * 1024 * 1024;
let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | undefined;

const loadPdfJs = async () => {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    return pdfjs;
  });
  return pdfjsPromise;
};

const cleanPdfText = (text: string) =>
  text
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const friendlyPdfError = (error: unknown) => {
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    if (name.includes('password') || message.includes('password')) {
      return 'This PDF appears to be password protected. Unlock it first, then upload again, or paste the text manually.';
    }
    if (name.includes('invalid') || message.includes('invalid pdf') || message.includes('bad xref')) {
      return 'This file could not be read as a valid PDF. Try exporting it again as a standard PDF, or paste the text manually.';
    }
    if (message.includes('worker')) {
      return 'PDF extraction could not start in this browser. Please retry; if it keeps failing, paste the extracted text manually.';
    }
    return error.message;
  }
  return 'PDF extraction failed. Retry the upload or paste the text manually.';
};

export const extractPdfText = async (file: File, onProgress?: (progress: number) => void): Promise<PdfExtractionResult> => {
  if (file.type && file.type !== 'application/pdf') {
    return {
      text: '',
      pageCount: 0,
      status: 'failed',
      error: 'This does not look like a PDF file. Upload a PDF, or paste the text manually.',
    };
  }

  if (file.size > maxPdfBytes) {
    return {
      text: '',
      pageCount: 0,
      status: 'failed',
      error: 'This PDF is larger than 25 MB. Compress it, split it into smaller files, or paste the relevant text manually.',
    };
  }

  try {
    const pdfjs = await loadPdfJs();
    onProgress?.(5);
    const bytes = await file.arrayBuffer();
    onProgress?.(12);
    const documentTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    const pdf = await documentTask.promise;
    const chunks: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      chunks.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      onProgress?.(Math.max(15, Math.round((pageNumber / pdf.numPages) * 100)));
    }

    const text = cleanPdfText(chunks.join('\n\n'));

    if (!text) {
      return {
        text: '',
        pageCount: pdf.numPages,
        status: 'failed',
        error: 'No selectable text was found. This PDF may be scanned or image-only. Use OCR first, or paste the extracted text manually.',
      };
    }

    return {
      text,
      pageCount: pdf.numPages,
      status: 'ready',
    };
  } catch (error) {
    return {
      text: '',
      pageCount: 0,
      status: 'failed',
      error: friendlyPdfError(error),
    };
  }
};
