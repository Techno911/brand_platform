import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import { Project } from '../projects/project.entity';
import { Row } from '../wizard/row.entity';
import { DocxExporterClient } from './docx-exporter.client';
import { S3ImmutableService } from './s3-immutable.service';
import { XlsxExporterService } from './xlsx-exporter.service';
import { AuditService } from '../observability/audit.service';

@Injectable()
export class ExporterService {
  private readonly logger = new Logger('ExporterService');

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Row) private readonly rows: Repository<Row>,
    private readonly docxClient: DocxExporterClient,
    private readonly s3: S3ImmutableService,
    private readonly xlsx: XlsxExporterService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Primary DOCX export: tries the isolated exporter container (production path).
   * If unreachable or not configured, falls back to in-process docx render (dev-only).
   * Always writes an immutable snapshot to S3.
   */
  async exportDocx(projectId: string, userId: string): Promise<{ s3Uri: string; bytes: Buffer; hash: string }> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    const rows = await this.rows.find({
      where: { projectId },
      order: { sheet: 'ASC', orderIndex: 'ASC' },
    });

    let bytes: Buffer;
    try {
      const rendered = await this.docxClient.render({
        template: 'brand-platform',
        payload: { project, rows },
      });
      bytes = rendered.bytes;
    } catch (err: any) {
      this.logger.warn(`docx-exporter fallback: ${err?.message}`);
      bytes = await this.renderInProcess(project, rows);
    }

    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const key = `projects/${projectId}/docx/${Date.now()}_${hash.slice(0, 12)}.docx`;
    const s3Uri = await this.s3.putBytes(
      key,
      bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      { 'bp-project': projectId, 'bp-hash': hash },
    );
    await this.audit.record({
      type: 'project.exported_docx',
      projectId,
      userId,
      responsibleUserId: userId,
      meta: { s3Uri, hash, bytes: bytes.length },
    });
    return { s3Uri, bytes, hash };
  }

  async exportXlsx(projectId: string, userId: string): Promise<{ s3Uri: string; bytes: Buffer; hash: string }> {
    const bytes = await this.xlsx.exportProject(projectId);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const key = `projects/${projectId}/xlsx/${Date.now()}_${hash.slice(0, 12)}.xlsx`;
    const s3Uri = await this.s3.putBytes(
      key,
      bytes,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      { 'bp-project': projectId, 'bp-hash': hash },
    );
    await this.audit.record({
      type: 'project.exported_xlsx',
      projectId,
      userId,
      responsibleUserId: userId,
      meta: { s3Uri, hash, bytes: bytes.length },
    });
    return { s3Uri, bytes, hash };
  }

  /** INSIGHTS §5 delta-6: immutable snapshot on owner_approved. */
  async writeImmutableSnapshot(params: {
    projectId: string;
    artifact: string;
    hash: string;
    content: Record<string, any>;
  }): Promise<{ s3Uri: string }> {
    const key = `projects/${params.projectId}/approvals/${params.artifact}/${Date.now()}_${params.hash.slice(0, 12)}.json`;
    const s3Uri = await this.s3.putJson(key, params.content, {
      'bp-project': params.projectId,
      'bp-artifact': params.artifact,
      'bp-hash': params.hash,
    });
    return { s3Uri };
  }

  // -- in-process fallback (dev only; production uses isolated container) --
  private async renderInProcess(project: Project, rows: Row[]): Promise<Buffer> {
    const sections: Array<{ children: Paragraph[] }> = [
      {
        children: [
          new Paragraph({ text: `Brand Platform — ${project.name}`, heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Индустрия: ${project.industry}`, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: `Тариф: ${project.tariff}`, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: `Статус: ${project.status}`, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: '' }),
          ...rows.map(
            (r) =>
              new Paragraph({
                children: [new TextRun({ text: `[лист ${r.sheet}] [${r.type}] ` })],
              }),
          ),
        ],
      },
    ];
    const doc = new Document({ sections });
    return Packer.toBuffer(doc);
  }
}
