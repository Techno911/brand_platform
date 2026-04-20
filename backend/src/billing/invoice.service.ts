import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from './invoice.entity';
import { Project } from '../projects/project.entity';
import { BillingConfigService } from './billing-config.service';
import { PromptRunService } from '../observability/prompt-run.service';
import { AuditService } from '../observability/audit.service';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice) private readonly repo: Repository<Invoice>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly cfg: BillingConfigService,
    private readonly runs: PromptRunService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  listForProject(projectId: string) {
    return this.repo.find({ where: { projectId }, order: { createdAt: 'DESC' } });
  }

  async issueProjectFinalization(projectId: string, actorUserId: string) {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const cfg = await this.cfg.get();
    const tariff = cfg.tariffs[project.tariff];
    if (!tariff) throw new NotFoundException(`Tariff not configured: ${project.tariff}`);

    const rawCostUsd = await this.runs.totalCostUsd(projectId);
    // Amount RUB = raw * factor * (1 + markup%) * rate
    const adjusted = rawCostUsd * cfg.anthropicCostFactor;
    const withMarkup = adjusted * (1 + tariff.markupPercent / 100);
    const amountRub = withMarkup * cfg.currencyRateUsdRub;

    const invoice = this.repo.create({
      kind: 'project_finalization' as InvoiceKind,
      status: 'draft' as InvoiceStatus,
      projectId,
      clientId: project.clientId,
      amountRub: amountRub.toFixed(2),
      rawCostUsd: rawCostUsd.toFixed(6),
      markupPercent: String(tariff.markupPercent),
      anthropicCostFactor: String(cfg.anthropicCostFactor),
      breakdown: {
        tariff: project.tariff,
        rawCostUsd,
        adjustedUsd: adjusted,
        withMarkupUsd: withMarkup,
        rateUsdRub: cfg.currencyRateUsdRub,
        amountRub,
      },
    });
    const saved = await this.repo.save(invoice);
    await this.audit.record({
      type: 'project.exported_docx',
      projectId,
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { invoiceId: saved.id, amountRub },
    });
    return saved;
  }

  async issueSubscription(clientId: string, tariffKey: string, actorUserId: string) {
    const cfg = await this.cfg.get();
    const tariff = cfg.tariffs[tariffKey];
    if (!tariff) throw new NotFoundException(`Tariff not configured: ${tariffKey}`);
    const invoice = this.repo.create({
      kind: 'subscription' as InvoiceKind,
      status: 'draft' as InvoiceStatus,
      clientId,
      amountRub: String(tariff.monthlyRub.toFixed(2)),
      rawCostUsd: '0',
      markupPercent: String(tariff.markupPercent),
      anthropicCostFactor: String(cfg.anthropicCostFactor),
      breakdown: { tariff: tariffKey, monthlyRub: tariff.monthlyRub },
    });
    const saved = await this.repo.save(invoice);
    await this.audit.record({
      type: 'admin.tariff_updated',
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { invoiceId: saved.id, tariff: tariffKey, amountRub: tariff.monthlyRub },
    });
    return saved;
  }

  async setStatus(id: string, status: InvoiceStatus, actorUserId: string, paymentRef?: string) {
    const inv = await this.repo.findOne({ where: { id } });
    if (!inv) throw new NotFoundException();
    inv.status = status;
    if (status === 'paid') {
      inv.paidAt = new Date();
      if (paymentRef) inv.paymentRef = paymentRef;
    }
    await this.repo.save(inv);
    await this.audit.record({
      type: 'admin.tariff_updated',
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { invoiceId: id, status, paymentRef },
    });
    return inv;
  }
}
