import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { db } from './db';

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN_X = 64;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 72;

const INK = rgb(0.04, 0.04, 0.04);
const GRAY = rgb(0.32, 0.32, 0.32);
const LIGHT = rgb(0.64, 0.64, 0.64);
const BORDER = rgb(0.88, 0.88, 0.88);
const GREEN = rgb(0.09, 0.64, 0.29);

const SCRIPT_FILES: Record<string, string> = {
  'var(--jo-font-script-1)': 'caveat.ttf',
  'var(--jo-font-script-2)': 'dancing.ttf',
  'var(--jo-font-script-3)': 'allura.ttf',
};

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

interface SigValue {
  kind: 'draw' | 'typed';
  text?: string;
  font?: string;
  dataUrl?: string;
}

export async function generateSignedPdf(documentId: string): Promise<Uint8Array> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: {
      fields: true,
      signers: { orderBy: { slot: 'asc' } },
      owner: { select: { name: true, email: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!doc) throw new Error('Document not found');

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const inter = await pdf.embedFont(StandardFonts.Helvetica);
  const interBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Embed script fonts lazily (only the ones actually used)
  const scriptFonts = new Map<string, PDFFont>();
  const embedScript = async (file: string): Promise<PDFFont | null> => {
    if (scriptFonts.has(file)) return scriptFonts.get(file)!;
    try {
      const bytes = await readFile(path.join(process.cwd(), 'src', 'assets', 'fonts', file));
      const font = await pdf.embedFont(bytes);
      scriptFonts.set(file, font);
      return font;
    } catch {
      return null; // some variable TTFs are not supported by fontkit
    }
  };

  const getScriptFont = async (key: string | undefined): Promise<PDFFont> => {
    const file = SCRIPT_FILES[key ?? ''] ?? 'caveat.ttf';
    return (await embedScript(file)) ?? (await embedScript('caveat.ttf')) ?? inter;
  };

  // ---------- Contract page(s) ----------
  let firstPage: PDFPage;

  if (doc.sourceType === 'pdf' && doc.pdfPath) {
    // Import the uploaded PDF's pages as-is; fields overlay on page 1.
    const srcBytes = await readFile(path.join(process.cwd(), 'public', doc.pdfPath));
    const src = await PDFDocument.load(srcBytes);
    const pages = await pdf.copyPages(src, src.getPageIndices());
    for (const p of pages) pdf.addPage(p);
    firstPage = pdf.getPage(0);
  } else {
    // Flow the structured text across as many pages as needed.
    firstPage = pdf.addPage([PAGE_W, PAGE_H]);
    let page = firstPage;
    let y = PAGE_H - MARGIN_TOP;
    const maxW = PAGE_W - MARGIN_X * 2;

    const ensure = (needed: number) => {
      if (y - needed < MARGIN_BOTTOM) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN_TOP;
      }
    };

    const blocks = doc.content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    blocks.forEach((block, i) => {
      const lines = block.split('\n');
      const first = lines[0] ?? '';
      const isTitled = first.endsWith(':');
      const title = isTitled ? first.slice(0, -1) : null;
      const body = (isTitled ? lines.slice(1) : lines).join('\n');

      if (title) {
        const size = i === 0 ? 20 : 12;
        ensure(size + 14);
        page.drawText(title, { x: MARGIN_X, y: y - size, size, font: interBold, color: INK });
        y -= size + (i === 0 ? 18 : 8);
      }
      if (body) {
        const size = 10.5;
        const lineH = 15.5;
        for (const line of wrap(body, inter, size, maxW)) {
          ensure(lineH);
          page.drawText(line, { x: MARGIN_X, y: y - size, size, font: inter, color: GRAY });
          y -= lineH;
        }
        y -= 8;
      }
    });
  }

  // ---------- Draw completed fields on their page (coords are % of that page) ----------
  const contentPages = pdf.getPages();

  for (const f of doc.fields) {
    // Página del campo (1-based, acotada a las páginas del contrato)
    const target = contentPages[Math.min(Math.max(f.page, 1), contentPages.length) - 1]!;
    const pw = target.getWidth();
    const ph = target.getHeight();
    const x = (f.x / 100) * pw;
    const wBox = (f.w / 100) * pw;
    const hBox = (f.h / 100) * ph;
    const yTop = (f.y / 100) * ph;
    const yBox = ph - yTop - hBox; // pdf-lib origin is bottom-left

    if (!f.value) continue;

    if (f.type === 'signature') {
      let sig: SigValue | null = null;
      try {
        sig = JSON.parse(f.value) as SigValue;
      } catch {
        sig = null;
      }
      if (sig?.kind === 'draw' && sig.dataUrl?.startsWith('data:image/png;base64,')) {
        const png = await pdf.embedPng(Buffer.from(sig.dataUrl.split(',')[1]!, 'base64'));
        const scale = Math.min(wBox / png.width, hBox / png.height);
        const w = png.width * scale;
        const h = png.height * scale;
        target.drawImage(png, { x: x + (wBox - w) / 2, y: yBox + (hBox - h) / 2, width: w, height: h });
      } else if (sig?.kind === 'typed' && sig.text) {
        const font = await getScriptFont(sig.font);
        let size = hBox * 0.62;
        while (size > 8 && font.widthOfTextAtSize(sig.text, size) > wBox * 0.94) size -= 1;
        target.drawText(sig.text, {
          x: x + (wBox - font.widthOfTextAtSize(sig.text, size)) / 2,
          y: yBox + hBox / 2 - size * 0.36,
          size,
          font,
          color: INK,
        });
      }
      // Signature baseline
      target.drawLine({
        start: { x: x + 2, y: yBox + 2 },
        end: { x: x + wBox - 2, y: yBox + 2 },
        thickness: 0.7,
        color: LIGHT,
      });
    } else if (f.type === 'checkbox') {
      target.drawRectangle({ x, y: yBox, width: wBox, height: hBox, borderColor: GRAY, borderWidth: 1 });
      const size = Math.min(wBox, hBox) * 0.72;
      target.drawText('X', {
        x: x + wBox / 2 - interBold.widthOfTextAtSize('X', size) / 2,
        y: yBox + hBox / 2 - size * 0.36,
        size,
        font: interBold,
        color: INK,
      });
    } else {
      let size = Math.min(hBox * 0.5, 11);
      while (size > 6 && inter.widthOfTextAtSize(f.value, size) > wBox * 0.95) size -= 0.5;
      target.drawText(f.value, {
        x: x + 4,
        y: yBox + hBox / 2 - size * 0.36,
        size,
        font: inter,
        color: INK,
      });
    }
  }

  // ---------- Certificate of completion ----------
  const cert = pdf.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - 72;

  cert.drawText('Certificate of Completion', { x: MARGIN_X, y: cy, size: 22, font: interBold, color: INK });
  cy -= 16;
  cert.drawText('Generated by Joansaro Contracts (demo environment)', { x: MARGIN_X, y: cy, size: 9.5, font: inter, color: LIGHT });
  cy -= 28;
  cert.drawLine({ start: { x: MARGIN_X, y: cy }, end: { x: PAGE_W - MARGIN_X, y: cy }, thickness: 1, color: BORDER });
  cy -= 28;

  const row = (label: string, value: string, opts?: { color?: ReturnType<typeof rgb>; bold?: boolean }) => {
    cert.drawText(label.toUpperCase(), { x: MARGIN_X, y: cy, size: 8, font: interBold, color: LIGHT });
    const lines = wrap(value, inter, 10.5, PAGE_W - MARGIN_X * 2 - 140);
    lines.forEach((line, idx) => {
      cert.drawText(line, {
        x: MARGIN_X + 140,
        y: cy - idx * 14,
        size: 10.5,
        font: opts?.bold ? interBold : inter,
        color: opts?.color ?? INK,
      });
    });
    cy -= Math.max(1, lines.length) * 14 + 10;
  };

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }) + ' UTC' : '—';

  row('Document', doc.title, { bold: true });
  row('Document ID', doc.id);
  row('Status', doc.status, { color: doc.status === 'SIGNED' ? GREEN : INK });
  row('Sender', `${doc.owner.name} <${doc.owner.email}>`);
  row('Signing order', doc.signingOrder === 'sequential' ? 'Sequential (in order)' : 'Parallel (any order)');
  for (const sg of doc.signers) {
    row(`Signer ${sg.slot}`, `${sg.name} <${sg.email}>`, { bold: true });
    row('  Sent', fmt(sg.sentAt));
    row('  Viewed', `${fmt(sg.viewedAt)}${sg.viewedIp ? `  ·  IP ${sg.viewedIp}` : ''}`);
    row('  Signed', `${fmt(sg.signedAt)}${sg.signedIp ? `  ·  IP ${sg.signedIp}` : ''}`);
    if (sg.signedUa) row('  Device', sg.signedUa.slice(0, 120));
  }
  if (doc.contentHash) row('SHA-256', doc.contentHash);
  row('Verify online', `${process.env.APP_URL ?? 'http://localhost:3010'}/verify/${doc.id}`);

  cy -= 8;
  cert.drawText('AUDIT TRAIL', { x: MARGIN_X, y: cy, size: 8, font: interBold, color: LIGHT });
  cy -= 18;
  for (const e of doc.events) {
    const stamp = new Date(e.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
    cert.drawCircle({ x: MARGIN_X + 3, y: cy + 3.5, size: 2.4, color: e.type === 'signed' ? GREEN : INK });
    cert.drawText(`${stamp} UTC`, { x: MARGIN_X + 14, y: cy, size: 9, font: interBold, color: INK });
    cert.drawText(e.detail ?? e.type, { x: MARGIN_X + 150, y: cy, size: 9, font: inter, color: GRAY });
    cy -= 17;
    if (cy < MARGIN_BOTTOM) break;
  }

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${doc.title} — ${doc.id}`, { x: MARGIN_X, y: 34, size: 7.5, font: inter, color: LIGHT });
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: p.getWidth() - MARGIN_X - inter.widthOfTextAtSize(`Page ${i + 1} of ${pages.length}`, 7.5),
      y: 34,
      size: 7.5,
      font: inter,
      color: LIGHT,
    });
  });

  pdf.setTitle(`${doc.title} — signed`);
  pdf.setCreator('Joansaro Contracts (demo)');
  return pdf.save();
}
