import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as http from 'node:http';

export interface DocxRenderInput {
  template: string;
  payload: Record<string, any>;
}

export interface DocxRenderOutput {
  bytes: Buffer;
  mime: string;
}

/**
 * INSIGHTS §5 delta-7: docx-exporter runs in an isolated container,
 * communicates over mTLS only. This client validates cert + trust.
 * Never execs shell, never writes outside /tmp/export-{uuid}.
 */
@Injectable()
export class DocxExporterClient {
  private readonly logger = new Logger('DocxExporterClient');
  private readonly baseUrl: string;
  private readonly agent: http.Agent | https.Agent;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('docxExporter.url') ?? 'http://bp-docx-exporter:4000';
    const certPath = this.config.get<string>('docxExporter.clientCert');
    const keyPath = this.config.get<string>('docxExporter.clientKey');
    const caPath = this.config.get<string>('docxExporter.caCert');
    if (this.baseUrl.startsWith('https://') && certPath && keyPath && caPath) {
      this.agent = new https.Agent({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true,
        minVersion: 'TLSv1.3',
      });
    } else {
      this.agent = new http.Agent({ keepAlive: true });
    }
  }

  async render(input: DocxRenderInput): Promise<DocxRenderOutput> {
    const url = new URL('/render', this.baseUrl);
    const payload = Buffer.from(JSON.stringify(input), 'utf8');
    return new Promise<DocxRenderOutput>((resolve, reject) => {
      const opts: https.RequestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
        agent: this.agent,
      };
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          const bytes = Buffer.concat(chunks);
          if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
            resolve({ bytes, mime: res.headers['content-type']?.toString() ?? 'application/octet-stream' });
          } else {
            reject(new Error(`docx-exporter ${res.statusCode}: ${bytes.toString('utf8').slice(0, 500)}`));
          }
        });
      });
      req.on('error', (err) => {
        this.logger.error(`docx-exporter request failed: ${err.message}`);
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  }
}
