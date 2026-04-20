#!/usr/bin/env node
// Auto-bump patch версии `PLATFORM.version` в src/config/platform.ts перед каждым build.
//
// Зачем: пользователь явно попросил «после каждого апдейта версия должна меняться».
// Руками ошибаться на +1 — рецепт забыть. Делаем prebuild-шаг: читаем платформу,
// парсим version: 'vX.Y.Z', инкрементируем Z, записываем обратно. При запуске dev
// (vite) этот скрипт не трогается — меняется только на `npm run build`.
//
// Почему patch, а не minor: мажор/минор отражают изменения методологии (см.
// docs/METHODOLOGY.md — 3.2 = перенос 3.1 на платформу), их меняет человек
// руками в момент значимого события. Patch = обычный деплой / фикс.
//
// NB: скрипт идемпотентен только в рамках одной сборки — повторный запуск
// инкрементирует снова. Это нормально: каждый build = отдельная версия.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformFile = resolve(__dirname, '..', 'src', 'config', 'platform.ts');

const src = await readFile(platformFile, 'utf8');

// Точный паттерн: version: 'v3.2.9' (после ключа `version:`, значение в кавычках, формат vX.Y.Z).
// Не меняем ничего больше в файле — минимальная правка.
const versionRe = /(\bversion:\s*')v(\d+)\.(\d+)\.(\d+)(')/;
const match = src.match(versionRe);
if (!match) {
  console.error('[bump-version] PLATFORM.version не найден в config/platform.ts — пропускаю bump.');
  process.exit(0); // не валим билд — это удобная автоматика, а не обязательная
}

// Cascade single-digit scheme (повторно подтверждено 2026-04-19):
// каждая из трёх частей — ОДНОЗНАЧНАЯ (0..9), при переполнении каскадирует выше.
// v3.4.9 → v3.5.0 → v3.5.1 → … → v3.9.9 → v4.0.0. «Трёхзначная» в терминологии
// пользователя = версия из 3 частей, а не «patch может быть многоразрядным».
// Мажор = смена методологии, минор = новый канон на стадии, патч = обычный build.
// Если кажется что v3.5.0 «выглядит как смена канона» — это и хорошо: каждые
// 10 билдов методология и правда сдвигается на что-то заметное; мажор/минор
// явно подсказывают собственнику «открой что-то на экране, оно изменилось».
let major = Number(match[2]);
let minor = Number(match[3]);
let patch = Number(match[4]) + 1;
if (patch > 9) {
  patch = 0;
  minor += 1;
}
if (minor > 9) {
  minor = 0;
  major += 1;
}
const newVersion = `v${major}.${minor}.${patch}`;
const prevVersion = `v${match[2]}.${match[3]}.${match[4]}`;

const next = src.replace(versionRe, `$1${newVersion}$5`);
await writeFile(platformFile, next, 'utf8');

console.log(`[bump-version] ${prevVersion} → ${newVersion}`);
