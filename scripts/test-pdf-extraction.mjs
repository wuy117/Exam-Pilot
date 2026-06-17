import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const fixtures = [
  {
    name: 'chemistry-acids.pdf',
    lines: [
      'GCSE Chemistry acids and alkalis revision notes',
      'Strong acids fully ionise in water.',
      'Neutralisation produces a salt and water.',
      'Required practical: making soluble salts.',
    ],
    expected: ['Chemistry', 'Neutralisation', 'soluble salts'],
  },
  {
    name: 'history-essay-plan.pdf',
    lines: [
      'IGCSE History essay planning guide',
      'Use judgement, evidence, and a clear line of argument.',
      'Explain causation and consequence with precise dates.',
      'Finish with a comparative conclusion.',
    ],
    expected: ['History', 'causation', 'comparative conclusion'],
  },
];

const writePdf = async (filePath, lines) => {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 64 });
    const stream = doc.pipe(createWriteStream(filePath));
    stream.on('finish', resolve);
    stream.on('error', reject);
    lines.forEach((line) => doc.text(line, { paragraphGap: 8 }));
    doc.end();
  });
};

const extract = async (filePath) => {
  const bytes = await fs.readFile(filePath);
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
  const chunks = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const pdfPage = await pdf.getPage(page);
    const content = await pdfPage.getTextContent();
    chunks.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return chunks.join('\n\n').replace(/\s+/g, ' ').trim();
};

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'exampilot-pdf-'));
const results = [];

for (const fixture of fixtures) {
  const filePath = path.join(dir, fixture.name);
  await writePdf(filePath, fixture.lines);
  const text = await extract(filePath);
  const missing = fixture.expected.filter((item) => !text.toLowerCase().includes(item.toLowerCase()));
  if (!text || missing.length) {
    throw new Error(`Extraction failed for ${fixture.name}. Missing: ${missing.join(', ') || 'all text'}`);
  }
  results.push({ file: fixture.name, chars: text.length, pages: 1 });
}

console.table(results);
