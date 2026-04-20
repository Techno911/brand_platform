import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Project } from '../projects/project.entity';
import { AnthropicClient } from './anthropic.client';
import { AIService } from './ai.service';
import { PromptLoaderService } from './prompt-loader.service';
import { CostCalculatorService } from './cost-calculator.service';
import { KnowledgeLoaderService } from './knowledge-loader.service';
import { RoundtripLimiterService } from './roundtrip-limiter.service';
import { ObservabilityModule } from '../observability/observability.module';
import { SecurityModule } from '../security/security.module';
import { BillingModule } from '../billing/billing.module';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenAICompatProvider } from './providers/openai-compat.provider';
import { VendorRouterService } from './vendor-router.service';
import { GlobalLLMQueueService } from './global-llm-queue.service';
import { ProjectBusyService } from './project-busy.service';
import { AIController } from './ai.controller';

/**
 * AIModule — multi-vendor LLM слой BP.
 *
 * Схема зависимостей:
 *   AIService
 *     ├── VendorRouterService → {AnthropicProvider, OpenAIProvider, OpenAICompatProvider}
 *     │                             └── AnthropicClient (SDK wrapper, native fetch для OpenAI/compat)
 *     ├── GlobalLLMQueueService  (per-vendor RPM/TPM token buckets)
 *     ├── ProjectBusyService     (pg_try_advisory_xact_lock per-project)
 *     └── {PromptLoader, KnowledgeLoader, CostCalculator, RoundtripLimiter,
 *          PromptRun, Metrics, Audit, BriefSanitizer, ToolCallSandbox, SecurityEvents}
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Project]),
    ObservabilityModule,
    SecurityModule,
    BillingModule,
  ],
  controllers: [AIController],
  providers: [
    AnthropicClient,
    AnthropicProvider,
    OpenAIProvider,
    OpenAICompatProvider,
    VendorRouterService,
    GlobalLLMQueueService,
    ProjectBusyService,
    AIService,
    PromptLoaderService,
    CostCalculatorService,
    KnowledgeLoaderService,
    RoundtripLimiterService,
  ],
  exports: [
    AIService,
    AnthropicClient,
    AnthropicProvider,
    OpenAIProvider,
    OpenAICompatProvider,
    VendorRouterService,
    GlobalLLMQueueService,
    ProjectBusyService,
    PromptLoaderService,
    KnowledgeLoaderService,
  ],
})
export class AIModule {}
