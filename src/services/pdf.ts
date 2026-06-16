import type { KnowledgeDocumentStatus } from '../types';

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  status: KnowledgeDocumentStatus;
  error?: string;
}

export const extractPdfText = async (file: File, onProgress?: (progress: number) => void): Promise<PdfExtractionResult> => {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

    const bytes = await file.arrayBuffer();
    const documentTask = pdfjs.getDocument({ data: bytes });
    const pdf = await documentTask.promise;
    const chunks: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      chunks.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      onProgress?.(Math.round((pageNumber / pdf.numPages) * 100));
    }

    return {
      text: chunks.join('\n\n').trim(),
      pageCount: pdf.numPages,
      status: 'ready',
    };
  } catch (error) {
    return {
      text: '',
      pageCount: 0,
      status: 'failed',
      error: error instanceof Error ? error.message : 'PDF extraction failed.',
    };
  }
};
