import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PromptLoaderService } from '../ai/prompt-loader.service';
import { VendorRouterService } from '../ai/vendor-router.service';
import {
  LLMProviderError,
  LLMRequest,
} from '../ai/providers/llm-provider.interface';

/**
 * Форма распарсенного договора. `null` вместо `""` там, где поле не заполнено.
 * Все null-поля попадают в `warnings[]` как человеческое описание —
 * wizard показывает их пользователю и просит дозаполнить вручную.
 *
 * Почему `warnings` вместо throw: договор Чиркова — это **шаблон** с пустыми
 * прочерками `______________`, который заполняется под конкретного заказчика.
 * Не факт что admin будет загружать полностью заполненную версию; возможно —
 * пустой шаблон, чтобы мастер предложил реквизиты из памяти. Строгий режим
 * (throw на пустое поле) сломает этот use-case.
 */
export interface ParsedContract {
  client: {
    name: string | null;
    legalForm: 'ooo' | 'ip' | 'self_employed' | 'individual' | null;
    inn: string | null;
    ogrn: string | null;
    legalAddress: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  owner: {
    fullName: string | null;
    email: string | null;
  } | null;
  contract: {
    number: string | null;
    signedAt: string | null;
    city: string | null;
    priceRub: number | null;
    termMonths: number | null;
  };
  warnings: string[];
}

/**
 * ContractParserService — LLM-экстрактор реквизитов Заказчика из договора.
 *
 * Use-case: chip_admin / tracker на первом шаге CreateClientWizard бросает
 * ссылку на Google Docs с договором → сервис тянет текст → Anthropic
 * возвращает JSON → wizard автозаполняет поля и показывает warnings для
 * пустых. Экономит ~2 минуты ручного ввода и убирает опечатки в ИНН/адресе.
 *
 * Архитектура:
 *   - PromptLoaderService загружает `prompts/contract-parse.md` (YAML frontmatter).
 *   - VendorRouter.pickProvider({category:'stage'}) → primary (Anthropic).
 *   - Прямой вызов provider.createMessage без ceremony AIService (не нужен
 *     projectId, prompt_run, cost_tracking — это pre-project extract).
 *
 * Безопасность: контракт загружается privileged ролями (chip_admin / tracker),
 * но мы всё равно проверяем очевидные jailbreak-маркеры, т.к. «доверенный
 * upload» не защищает от подрядчика-злоумышленника, подсунувшего .docx с
 * prompt injection. PII redaction НЕ применяется — нам наоборот нужно
 * извлечь ИНН/телефон/email заказчика.
 */
@Injectable()
export class ContractParserService {
  private readonly logger = new Logger('ContractParserService');
  private readonly maxTextLength = 80_000; // ~20k токенов hard cap на input

  constructor(
    private readonly prompts: PromptLoaderService,
    private readonly router: VendorRouterService,
  ) {}

  /**
   * Основной entry-point: ссылка на Google Docs → ParsedContract.
   * URL должен быть вида `https://docs.google.com/document/d/{fileId}/...`.
   */
  async parseFromGoogleDocs(url: string): Promise<ParsedContract> {
    const fileId = this.extractGoogleDocsFileId(url);
    const text = await this.fetchGoogleDocsText(fileId);
    return this.parseFromText(text);
  }

  /**
   * Парсинг готового текста (используется и через file upload в будущем).
   */
  async parseFromText(text: string): Promise<ParsedContract> {
    if (!text || text.trim().length < 100) {
      throw new BadRequestException('Текст договора слишком короткий — похоже, не удалось скачать документ');
    }

    const trimmed = text.length > this.maxTextLength
      ? text.slice(0, this.maxTextLength)
      : text;

    if (this.hasObviousInjection(trimmed)) {
      this.logger.warn('Contract text contains prompt-injection markers, rejecting');
      throw new BadRequestException(
        'Текст содержит подозрительные маркеры prompt-injection. Проверьте файл или загрузите другой.',
      );
    }

    // Prompt template: {{contractText}} → реальный текст.
    const prompt = this.prompts.get('contract-parse');
    const body = prompt.body.replace('{{contractText}}', trimmed);

    const decision = this.router.pickProvider({ category: 'stage' });
    const provider = decision.provider;

    const request: LLMRequest = {
      // Всегда берём defaultModel() выбранного провайдера, а не prompt.meta.model
      // (там hardcoded 'claude-opus-4-7' — при fallback'е на OpenAI это сломается).
      model: provider.defaultModel(),
      system: [
        {
          type: 'text',
          text: 'Ты строгий JSON-экстрактор. Возвращаешь ТОЛЬКО валидный JSON без markdown-обёртки. Никаких комментариев, пояснений, префиксов.',
        },
      ],
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: body }],
        },
      ],
      maxOutputTokens: prompt.meta.maxOutputTokens ?? 1500,
      temperature: 0.1, // экстракция детерминирована, креативность не нужна
    };

    let response;
    try {
      response = await provider.createMessage(request);
    } catch (err) {
      const llmErr = err instanceof LLMProviderError ? err : null;
      this.logger.error(
        `Contract parse LLM call failed: vendor=${llmErr?.vendor} category=${llmErr?.category} message=${(err as Error)?.message}`,
      );
      throw new BadRequestException(
        'LLM-провайдер вернул ошибку при разборе договора. Попробуйте ещё раз или заполните поля вручную.',
      );
    }

    const textBlock = response.content.find((c) => c.type === 'text')?.text ?? '';
    return this.parseAndNormalize(textBlock);
  }

  /** `https://docs.google.com/document/d/1WVc_Uiti7O9tY75EAWGOyCA_PZ6RNlbC/edit` → `1WVc_Uiti7...`. */
  private extractGoogleDocsFileId(url: string): string {
    const trimmed = (url ?? '').trim();
    if (!trimmed) throw new BadRequestException('URL не указан');
    const match = /\/document\/d\/([a-zA-Z0-9_-]{10,})/.exec(trimmed);
    if (!match) {
      throw new BadRequestException(
        'Ссылка не похожа на Google Docs. Ожидаю вид https://docs.google.com/document/d/{ID}/...',
      );
    }
    return match[1];
  }

  /**
   * Скачивает документ через публичный export-endpoint Google Docs.
   * Работает только если документ доступен по ссылке (Share → Anyone with the link / viewer).
   * Для private docs нужен OAuth — out of scope MVP, wizard предложит fallback на ручной ввод.
   */
  private async fetchGoogleDocsText(fileId: string): Promise<string> {
    const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'follow' });
    } catch (err) {
      this.logger.error(`Google Docs fetch network error: ${(err as Error).message}`);
      throw new BadRequestException(
        'Не удалось подключиться к Google Docs. Проверьте сеть или загрузите файл вручную.',
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new BadRequestException(
          'Google Docs не отдаёт документ. Убедитесь, что доступ открыт по ссылке (Share → Anyone with the link).',
        );
      }
      throw new BadRequestException(`Google Docs вернул HTTP ${res.status}. Попробуйте позже.`);
    }

    const text = await res.text();
    if (!text || text.length < 50) {
      throw new BadRequestException('Google Docs вернул пустой текст. Возможно, документ ещё не индексирован.');
    }
    return text;
  }

  /** Дешёвая проверка на топ-пяток jailbreak-маркеров. Полный санитайзер — overkill для trusted upload'а. */
  private hasObviousInjection(text: string): boolean {
    const patterns: RegExp[] = [
      /ignore (?:all |the )?previous instructions?/i,
      /disregard (?:all |the )?(?:prior|previous|above)/i,
      /you are now (?:DAN|an? unrestricted)/i,
      /reveal (?:the |your )?system prompt/i,
      /<\|im_start\|>|<\|im_end\|>/i,
    ];
    return patterns.some((rx) => rx.test(text));
  }

  /**
   * Извлекает JSON из ответа LLM (снимает markdown-обёртку если есть) и
   * нормализует форму: гарантирует наличие всех полей, приводит типы,
   * дефолтит `warnings = []`.
   */
  private parseAndNormalize(raw: string): ParsedContract {
    let cleaned = raw.trim();
    const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;
    const m = fence.exec(cleaned);
    if (m) cleaned = m[1].trim();

    let data: any;
    try {
      data = JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`LLM returned non-JSON: ${cleaned.slice(0, 300)}`);
      throw new BadRequestException(
        'Модель вернула некорректный JSON. Попробуйте ещё раз или загрузите другой файл.',
      );
    }

    const client = data?.client ?? {};
    const owner = data?.owner ?? null;
    const contract = data?.contract ?? {};
    const warnings: string[] = Array.isArray(data?.warnings) ? data.warnings.filter((w: unknown) => typeof w === 'string') : [];

    const legalForm: ParsedContract['client']['legalForm'] =
      client.legalForm === 'ooo' ||
      client.legalForm === 'ip' ||
      client.legalForm === 'self_employed' ||
      client.legalForm === 'individual'
        ? client.legalForm
        : null;

    return {
      client: {
        name: this.asNullableString(client.name),
        legalForm,
        inn: this.asNullableString(client.inn),
        ogrn: this.asNullableString(client.ogrn),
        legalAddress: this.asNullableString(client.legalAddress),
        contactEmail: this.asNullableString(client.contactEmail),
        contactPhone: this.asNullableString(client.contactPhone),
      },
      owner: owner
        ? {
            fullName: this.asNullableString(owner.fullName),
            email: this.asNullableString(owner.email),
          }
        : null,
      contract: {
        number: this.asNullableString(contract.number),
        signedAt: this.asNullableString(contract.signedAt),
        city: this.asNullableString(contract.city),
        priceRub: this.asNullableNumber(contract.priceRub),
        termMonths: this.asNullableNumber(contract.termMonths),
      },
      warnings,
    };
  }

  private asNullableString(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    if (!trimmed || trimmed === 'null') return null;
    return trimmed;
  }

  private asNullableNumber(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[\s₽]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
}
