import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  async check() {
    let db = 'unknown';
    try {
      await this.ds.query('SELECT 1');
      db = 'ok';
    } catch (err: any) {
      db = `fail:${err?.message ?? 'unknown'}`;
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.ds.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      return { status: 'not_ready' };
    }
  }
}
