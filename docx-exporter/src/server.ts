/**
 * BP docx-exporter — изолированный сервис по рендеру DOCX.
 *
 * INSIGHTS §5 delta-7: read-only root filesystem, /tmp — tmpfs, общение ТОЛЬКО через mTLS.
 * Не делает exec, не сохраняет ничего на диск (только /tmp/export-{uuid}), не имеет сетевого доступа наружу.
 *
 * Endpoint: POST /render  { template: string, payload: Record<string, any> } → application/octet-stream
 */
import * as http from 'node:http';
import * as https from 'node:https';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from 'docx';

const PORT = Number(process.env.PORT ?? 4000);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const TLS_CERT = process.env.TLS_CERT;
const TLS_KEY = process.env.TLS_KEY;
const TLS_CLIENT_CA = process.env.TLS_CLIENT_CA;

type Input = { template: string; payload: Record<string, any> };

async function render(input: Input): Promise<Buffer> {
  const uuid = crypto.randomUUID();
  const tmp = path.join('/tmp', `export-${uuid}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    let doc: Document;
    switch (input.template) {
      case 'brand_book': doc = renderBrandBook(input.payload); break;
      case 'stage_snapshot': doc = renderStageSnapshot(input.payload); break;
      default: throw new Error(`unknown template: ${input.template}`);
    }
    return await Packer.toBuffer(doc);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

function renderBrandBook(payload: Record<string, any>): Document {
  const {
    brand_name = 'Бренд',
    client_name = '',
    industry = '',
    legend = '',
    values = [],
    mission = '',
    vision = '',
    archetype = '',
    positioning = '',
    brand_message = '',
    tests = [],
    generated_at = new Date().toISOString(),
  } = payload;

  const paragraphs: Paragraph[] = [
    new Paragraph({ text: brand_name, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `${client_name} · ${industry}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `Бренд-книга по методологии 3.1. Сгенерировано ${new Date(generated_at).toLocaleDateString('ru-RU')}.`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: '' }),

    new Paragraph({ text: '1. Легенда', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(legend),

    new Paragraph({ text: '2. Ценности', heading: HeadingLevel.HEADING_1 }),
    ...(Array.isArray(values) ? values : []).map((v: any) =>
      new Paragraph({ text: typeof v === 'string' ? v : `${v.name}: ${v.behaviour}`, bullet: { level: 0 } }),
    ),

    new Paragraph({ text: '3. Миссия', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(mission),

    ...(vision ? [new Paragraph({ text: '4. Видение', heading: HeadingLevel.HEADING_1 }), new Paragraph(vision)] : []),

    new Paragraph({ text: '5. Архетип и позиционирование', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: 'Архетип: ', bold: true }), new TextRun(archetype)] }),
    new Paragraph({ children: [new TextRun({ text: 'Позиционирование: ', bold: true }), new TextRun(positioning)] }),

    new Paragraph({ text: '6. Месседж бренда', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: brand_message, bold: true, size: 32 })], alignment: AlignmentType.CENTER }),

    new Paragraph({ text: '7. Валидация месседжа (4 теста)', heading: HeadingLevel.HEADING_1 }),
    ...(Array.isArray(tests) ? tests : []).map((t: any) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${t.passed ? '✓' : '✗'} `, bold: true }),
          new TextRun({ text: `${t.name ?? ''} — ` , bold: true }),
          new TextRun(t.reasoning ?? ''),
        ],
      }),
    ),
  ];

  return new Document({ sections: [{ properties: {}, children: paragraphs }] });
}

function renderStageSnapshot(payload: Record<string, any>): Document {
  const { stage = 0, artifact = '', content = {} } = payload;
  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: `Стадия ${stage}. ${artifact}`, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `Snapshot от ${new Date().toLocaleString('ru-RU')}` }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: JSON.stringify(content, null, 2) }),
      ],
    }],
  });
}

const handler: http.RequestListener = async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/render') {
    res.writeHead(404); res.end('Not Found'); return;
  }

  const chunks: Buffer[] = [];
  let received = 0;
  req.on('data', (c) => {
    received += c.length;
    if (received > MAX_BODY_BYTES) {
      res.writeHead(413); res.end('Payload Too Large'); req.destroy();
      return;
    }
    chunks.push(Buffer.from(c));
  });
  req.on('end', async () => {
    try {
      const body = Buffer.concat(chunks).toString('utf8');
      const input = JSON.parse(body) as Input;
      if (!input || typeof input.template !== 'string' || typeof input.payload !== 'object') {
        res.writeHead(400); res.end('Bad Request'); return;
      }
      const bytes = await render(input);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Length': bytes.length,
      });
      res.end(bytes);
    } catch (err: any) {
      res.writeHead(500); res.end(`render_failed: ${err?.message ?? 'unknown'}`);
    }
  });
  req.on('error', () => {
    res.writeHead(500); res.end('request_error');
  });
};

function startServer() {
  if (TLS_CERT && TLS_KEY && TLS_CLIENT_CA) {
    const server = https.createServer({
      cert: fs.readFileSync(TLS_CERT),
      key: fs.readFileSync(TLS_KEY),
      ca: fs.readFileSync(TLS_CLIENT_CA),
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.3',
    }, handler);
    server.listen(PORT, () => console.log(`[docx-exporter] https+mTLS on :${PORT}`));
  } else {
    http.createServer(handler).listen(PORT, () => console.log(`[docx-exporter] http (dev) on :${PORT}`));
  }
}

startServer();
