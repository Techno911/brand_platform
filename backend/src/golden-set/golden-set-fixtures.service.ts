import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GoldenCase {
  name: string;
  artifact: string;
  input: Record<string, any>;
  expected: Record<string, any>;
  tags?: string[];
}

/**
 * Loads golden-set YAML/JSON cases from ./golden-set/ directory.
 * Includes "Белая Линия" reference (file 01, Walk-Forward Backtesting metaphor).
 */
@Injectable()
export class GoldenSetFixturesService implements OnModuleInit {
  private readonly logger = new Logger('GoldenSetFixturesService');
  private cases: GoldenCase[] = [];

  private readonly roots = [
    process.env.GOLDEN_SET_PATH ?? '',
    path.resolve(process.cwd(), 'golden-set'),
    path.resolve(__dirname, '../../../golden-set'),
    path.resolve(__dirname, '../../golden-set'),
    '/app/golden-set',
  ].filter(Boolean);

  onModuleInit(): void {
    this.reload();
  }

  reload(): void {
    this.cases = [];
    for (const root of this.roots) {
      if (!fs.existsSync(root)) continue;
      this.loadDir(root);
    }
    this.logger.log(`Golden set: ${this.cases.length} cases loaded`);
  }

  private loadDir(root: string) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        this.loadDir(full);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            for (const c of parsed) this.cases.push(c);
          } else if (parsed?.cases && Array.isArray(parsed.cases)) {
            for (const c of parsed.cases) this.cases.push(c);
          } else if (parsed?.name && parsed?.artifact) {
            this.cases.push(parsed as GoldenCase);
          }
        } catch (err: any) {
          this.logger.warn(`golden fixture ${full} parse failed: ${err?.message}`);
        }
      }
    }
  }

  list(): GoldenCase[] {
    return this.cases;
  }

  listByTag(tag: string): GoldenCase[] {
    return this.cases.filter((c) => c.tags?.includes(tag));
  }
}
