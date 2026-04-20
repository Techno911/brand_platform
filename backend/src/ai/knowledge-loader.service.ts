import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Industry } from '../projects/project.entity';

export interface KnowledgeBlock {
  key: string;
  path: string;
  body: string;
  hash: string;
}

/**
 * KnowledgeLoaderService — industry_context/*.md + industry_gotchas/*.md.
 * Per INSIGHTS §9 and anti-pattern "do not load ALL knowledge every call":
 *   - industry_context is loaded once per (industry, call) into cache_control: ephemeral.
 *   - industry_gotchas is loaded per industry so the context is scoped.
 */
@Injectable()
export class KnowledgeLoaderService implements OnModuleInit {
  private readonly logger = new Logger('KnowledgeLoaderService');
  private readonly ctxByIndustry = new Map<Industry, KnowledgeBlock>();
  private readonly gotchasByIndustry = new Map<Industry, KnowledgeBlock>();
  private readonly skillsByName = new Map<string, KnowledgeBlock>();

  private readonly roots = [
    process.env.KNOWLEDGE_PATH ?? '',
    path.resolve(process.cwd(), 'knowledge'),
    path.resolve(__dirname, '../../../knowledge'),
    path.resolve(__dirname, '../../knowledge'),
    '/app/knowledge',
  ].filter(Boolean);

  onModuleInit(): void {
    this.reload();
  }

  reload(): void {
    this.ctxByIndustry.clear();
    this.gotchasByIndustry.clear();
    this.skillsByName.clear();
    for (const root of this.roots) {
      if (!fs.existsSync(root)) continue;
      this.loadIndustry(path.join(root, 'industry_context'), this.ctxByIndustry);
      this.loadIndustry(path.join(root, 'industry_gotchas'), this.gotchasByIndustry);
      this.loadSkills(path.join(root, 'skills'));
    }
    this.logger.log(
      `Knowledge loaded: contexts=${this.ctxByIndustry.size} gotchas=${this.gotchasByIndustry.size} skills=${this.skillsByName.size}`,
    );
  }

  private loadIndustry(dir: string, bucket: Map<Industry, KnowledgeBlock>) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const industry = path.basename(entry.name, '.md') as Industry;
      const full = path.join(dir, entry.name);
      const body = fs.readFileSync(full, 'utf8');
      bucket.set(industry, {
        key: industry,
        path: full,
        body,
        hash: crypto.createHash('sha256').update(body).digest('hex'),
      });
    }
  }

  private loadSkills(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const name = path.basename(entry.name, '.md');
      const full = path.join(dir, entry.name);
      const body = fs.readFileSync(full, 'utf8');
      this.skillsByName.set(name, {
        key: name,
        path: full,
        body,
        hash: crypto.createHash('sha256').update(body).digest('hex'),
      });
    }
  }

  industryContext(industry: Industry): KnowledgeBlock | null {
    return this.ctxByIndustry.get(industry) ?? null;
  }

  industryGotchas(industry: Industry): KnowledgeBlock | null {
    return this.gotchasByIndustry.get(industry) ?? null;
  }

  skill(name: string): KnowledgeBlock | null {
    return this.skillsByName.get(name) ?? null;
  }
}
