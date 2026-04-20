import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface PromptMeta {
  name: string;
  description?: string;
  trigger?: string;
  expectedOutputSchema?: any;
  stage?: 1 | 2 | 3 | 4;
  model?: string;
  maxOutputTokens?: number;
  cacheable?: boolean;
  version?: string;
}

export interface LoadedPrompt {
  name: string;
  path: string;
  version: string;
  meta: PromptMeta;
  body: string;
  hash: string;
}

/**
 * YAML-frontmatter prompt loader. Reads ./prompts/*.md at startup and hot-reload on request.
 *
 * Format:
 *   ---
 *   name: values-draft
 *   stage: 2
 *   model: claude-opus-4-7
 *   maxOutputTokens: 4096
 *   cacheable: true
 *   version: 1.0.0
 *   ---
 *   You are ...
 */
@Injectable()
export class PromptLoaderService implements OnModuleInit {
  private readonly logger = new Logger('PromptLoaderService');
  private prompts = new Map<string, LoadedPrompt>();
  private readonly rootCandidates = [
    process.env.PROMPT_LIB_PATH ?? '',
    path.resolve(process.cwd(), 'prompts'),
    path.resolve(__dirname, '../../../prompts'),
    path.resolve(__dirname, '../../prompts'),
    '/app/prompts',
  ].filter(Boolean);

  onModuleInit(): void {
    this.reloadAll();
  }

  list(): string[] {
    return Array.from(this.prompts.keys());
  }

  get(name: string): LoadedPrompt {
    const p = this.prompts.get(name);
    if (!p) {
      throw new Error(`prompt template not found: ${name}. Available: ${this.list().join(', ')}`);
    }
    return p;
  }

  reloadAll(): void {
    for (const root of this.rootCandidates) {
      try {
        if (fs.existsSync(root)) {
          this.loadDir(root);
        }
      } catch (err: any) {
        this.logger.warn(`prompt root "${root}" failed: ${err?.message}`);
      }
    }
    this.logger.log(`Loaded ${this.prompts.size} prompt templates`);
  }

  private loadDir(root: string): void {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(root, e.name);
      if (e.isDirectory()) {
        this.loadDir(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        this.loadFile(full);
      }
    }
  }

  private loadFile(file: string): void {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const parsed = this.parseFrontmatter(content);
      const name = parsed.meta.name ?? path.basename(file, '.md');
      const version = parsed.meta.version ?? '1.0.0';
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      this.prompts.set(name, {
        name,
        path: file,
        version,
        meta: parsed.meta,
        body: parsed.body,
        hash,
      });
    } catch (err: any) {
      this.logger.error(`failed to load prompt ${file}: ${err?.message}`);
    }
  }

  private parseFrontmatter(content: string): { meta: PromptMeta; body: string } {
    if (!content.startsWith('---')) return { meta: { name: '' }, body: content };
    const end = content.indexOf('\n---', 3);
    if (end < 0) return { meta: { name: '' }, body: content };
    const headerRaw = content.slice(3, end).trim();
    const body = content.slice(end + 4).trimStart();
    const meta = this.parseSimpleYaml(headerRaw);
    return { meta, body };
  }

  /** Small hand-rolled YAML subset: `key: value` and `key:` with indented children. */
  private parseSimpleYaml(text: string): PromptMeta {
    const out: any = {};
    const lines = text.split('\n');
    for (const raw of lines) {
      const line = raw.replace(/#.*$/, '').trimEnd();
      if (!line.trim()) continue;
      const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, key, value] = m;
      if (value === '') continue;
      let v: any = value.trim();
      if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
      else if (v === 'true') v = true;
      else if (v === 'false') v = false;
      else if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
      out[key] = v;
    }
    return out as PromptMeta;
  }
}
