import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ExporterService } from './exporter.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class ExporterController {
  constructor(private readonly exporter: ExporterService) {}

  @Roles('chip_admin', 'tracker', 'marketer', 'owner_viewer')
  @Post('projects/:id/docx')
  async docx(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const r = await this.exporter.exportDocx(id, u.id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="bp-${id}.docx"`);
    res.setHeader('X-BP-S3', r.s3Uri);
    res.setHeader('X-BP-Hash', r.hash);
    res.send(r.bytes);
  }

  @Roles('chip_admin', 'tracker', 'marketer', 'owner_viewer')
  @Post('projects/:id/xlsx')
  async xlsx(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const r = await this.exporter.exportXlsx(id, u.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bp-${id}.xlsx"`);
    res.setHeader('X-BP-S3', r.s3Uri);
    res.setHeader('X-BP-Hash', r.hash);
    res.send(r.bytes);
  }
}
