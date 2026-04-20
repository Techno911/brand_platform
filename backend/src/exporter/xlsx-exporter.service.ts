import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Row } from '../wizard/row.entity';

@Injectable()
export class XlsxExporterService {
  constructor(
    @InjectRepository(Row) private readonly rows: Repository<Row>,
  ) {}

  async exportProject(projectId: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Brand Platform';
    wb.created = new Date();

    const rows = await this.rows.find({
      where: { projectId },
      order: { sheet: 'ASC', orderIndex: 'ASC' },
    });
    const bySheet = new Map<number, Row[]>();
    for (const r of rows) {
      const list = bySheet.get(r.sheet) ?? [];
      list.push(r);
      bySheet.set(r.sheet, list);
    }

    const sheetNames: Record<number, string> = {
      1: '1. Интервью',
      2: '2. Отзывы',
      3: '3. Конкуренты',
      4: '4. Сессия',
      5: '5. Архетип+позиция',
      6: '6. Бренд-месседж',
    };

    for (let i = 1; i <= 6; i++) {
      const ws = wb.addWorksheet(sheetNames[i]);
      ws.columns = [
        { header: '#', key: 'idx', width: 6 },
        { header: 'Тип', key: 'type', width: 20 },
        { header: 'Данные', key: 'payload', width: 60 },
        { header: 'Финализировано', key: 'finalized', width: 40 },
      ];
      const list = bySheet.get(i) ?? [];
      list.forEach((row, idx) => {
        ws.addRow({
          idx: idx + 1,
          type: row.type,
          payload: JSON.stringify(row.payload ?? {}, null, 2),
          finalized: row.finalized ? JSON.stringify(row.finalized, null, 2) : '—',
        });
      });
      ws.getRow(1).font = { bold: true };
    }

    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }
}
