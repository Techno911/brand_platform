// Единый источник правды для архетипов бренда.
//
// ЧиП использует 6 базовых архетипов вместо полной 12-архетипной сетки Jung —
// для малого B2C-бизнеса этого достаточно, а маркетологу проще выбрать
// из 6, чем из 12. См. BUSINESS_LOGIC.md §3.
//
// Если в проекте попадается клиент, у которого мотив явно ложится на Jung-архетип
// вне этой шестёрки (Любовник / Шут / Творец / Герой / Маг / Славный парень) —
// это повод подумать, а не повод расширять канон. Чирков сознательно режет
// до 6, чтобы процесс оставался управляемым.
//
// Маппинг на Jung-оригиналы (для промпта/LLM):
//  · Заботливый   = Caregiver
//  · Мудрец       = Sage
//  · Бунтарь      = Outlaw / Rebel
//  · Искатель     = Explorer
//  · Правитель    = Ruler
//  · Простодушный = Innocent
//
// Это же используется промптом `backend/prompts/positioning-draft.md` —
// ключи держим ровно те же, которые там в `expectedOutputSchema.archetype.primary`.
export const ARCHETYPES = [
  {
    key: 'caregiver',
    ru: 'Заботливый',
    short: 'Защищает и опекает',
    // одна бытовая сцена, чтобы маркетолог сразу узнавал своего клиента
    example: 'Семейная стоматология, которая звонит на следующий день «как ощущения?»',
  },
  {
    key: 'sage',
    ru: 'Мудрец',
    short: 'Понимает и объясняет',
    example: 'Клиника, где врач чертит схему зубов и разбирает альтернативы',
  },
  {
    key: 'rebel',
    ru: 'Бунтарь',
    short: 'Идёт против индустриальных правил',
    example: 'Ресторан, который варит борщ без майонеза и без «традиции как у мамы»',
  },
  {
    key: 'explorer',
    ru: 'Искатель',
    short: 'Даёт свободу и новое',
    example: 'Автосервис, который первым в городе ставит диагностический сканер',
  },
  {
    key: 'ruler',
    ru: 'Правитель',
    short: 'Несёт порядок и стандарт',
    example: 'Клиника с регламентом на каждый шаг приёма и прозрачной сметой до начала',
  },
  {
    key: 'innocent',
    ru: 'Простодушный',
    short: 'Возвращает в простое и честное',
    example: 'Салон красоты без апсейлов — «подстригём ровно столько, сколько нужно»',
  },
] as const;

export type ArchetypeKey = (typeof ARCHETYPES)[number]['key'];

/** Карта ru-label → key, чтобы промпт мог отвечать русским названием, а фронт
 * всё равно знал какой это архетип. LLM иногда возвращает регистр или лёгкий
 * синонимичный вариант — `resolveArchetypeKey` толерантен к этому. */
export function resolveArchetypeKey(raw: string | undefined | null): ArchetypeKey | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  for (const a of ARCHETYPES) {
    if (norm === a.key) return a.key;
    if (norm === a.ru.toLowerCase()) return a.key;
  }
  // fallback — допускаем, что LLM мог вернуть английский Jung-оригинал
  const jungMap: Record<string, ArchetypeKey> = {
    caregiver: 'caregiver',
    sage: 'sage',
    outlaw: 'rebel',
    rebel: 'rebel',
    explorer: 'explorer',
    ruler: 'ruler',
    innocent: 'innocent',
  };
  return jungMap[norm] ?? null;
}

/** ru-название архетипа по key; для рендера в карточках. */
export function archetypeRu(key: string | undefined | null): string | null {
  const resolved = resolveArchetypeKey(key);
  if (!resolved) return null;
  return ARCHETYPES.find((a) => a.key === resolved)?.ru ?? null;
}
