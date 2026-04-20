import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { AIModule } from './ai/ai.module';
import { SecurityModule } from './security/security.module';
import { WizardModule } from './wizard/wizard.module';
import { ValidatorModule } from './validator/validator.module';
import { GoldenSetModule } from './golden-set/golden-set.module';
import { BillingModule } from './billing/billing.module';
import { ObservabilityModule } from './observability/observability.module';
import { ExporterModule } from './exporter/exporter.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('db.host'),
        port: cfg.get<number>('db.port'),
        username: cfg.get<string>('db.user'),
        password: cfg.get<string>('db.password'),
        database: cfg.get<string>('db.name'),
        ssl: cfg.get<boolean>('db.ssl') ? { rejectUnauthorized: true } : false,
        // Миграции и CLI datasource используют snake_case. Держим одну стратегию.
        namingStrategy: new SnakeNamingStrategy(),
        autoLoadEntities: true,
        synchronize: false,
        logging: ['error', 'warn'],
      }),
    }),
    // Два правила: burst-защита (30 запросов за 1 секунду) + sustained (120 / мин).
    // Burst нужен против DDoS/брутфорса, sustained — против крипта-маяков/ботов.
    // INSIGHTS §5 «rate limiting и защита от злоупотреблений маркетологом».
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 1_000, limit: 30 },
      { name: 'sustained', ttl: 60_000, limit: 120 },
    ]),
    // @nestjs/schedule: cron-триггеры (ежедневный дайджест chip_admin 09:00 MSK).
    // Без forRoot() декораторы @Cron() молча игнорируются.
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ClientsModule,
    ProjectsModule,
    AIModule,
    SecurityModule,
    WizardModule,
    ValidatorModule,
    GoldenSetModule,
    BillingModule,
    ObservabilityModule,
    ExporterModule,
    IntegrationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
