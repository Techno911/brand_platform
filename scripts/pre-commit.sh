#!/usr/bin/env bash
# Git pre-commit hook Brand Platform (INSIGHTS §5 delta-9).
# Устанавливается: ./scripts/install-git-hooks.sh
#
# Проверки:
#  1) gitleaks — секреты в staged diff
#  2) backend & frontend tsc --noEmit на staged TS-файлах
#  3) запрет коммита в main/prompts без прогона golden-set (warning, не FAIL)
set -euo pipefail

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

info() { echo -e "${GREEN}[pre-commit]${NC} $*"; }
warn() { echo -e "${YELLOW}[pre-commit WARN]${NC} $*"; }
fail() { echo -e "${RED}[pre-commit FAIL]${NC} $*" >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# --- 1. gitleaks ---
if command -v gitleaks >/dev/null 2>&1; then
  info "gitleaks protect (staged diff)..."
  gitleaks protect --staged --redact --config=.gitleaks.toml \
    || fail "gitleaks обнаружил утечку. Удали секрет и повтори. Для false-positive добавь в allowlist .gitleaks.toml."
else
  warn "gitleaks не установлен. brew install gitleaks / apt install gitleaks. Пропуск."
fi

# --- 2. Локальный TS-чек (backend) ---
STAGED_BACKEND_TS=$(git diff --cached --name-only --diff-filter=ACMR | grep '^backend/.*\.ts$' || true)
if [[ -n "$STAGED_BACKEND_TS" ]]; then
  info "backend: tsc --noEmit (staged changes)..."
  ( cd backend && npx tsc --noEmit ) || fail "backend/tsc упал. Исправь ошибки TypeScript."
fi

STAGED_FRONTEND_TS=$(git diff --cached --name-only --diff-filter=ACMR | grep '^frontend/.*\.\(ts\|tsx\)$' || true)
if [[ -n "$STAGED_FRONTEND_TS" ]]; then
  info "frontend: tsc --noEmit (staged changes)..."
  ( cd frontend && npx tsc --noEmit ) || fail "frontend/tsc упал. Исправь ошибки TypeScript."
fi

STAGED_EXPORTER_TS=$(git diff --cached --name-only --diff-filter=ACMR | grep '^docx-exporter/.*\.ts$' || true)
if [[ -n "$STAGED_EXPORTER_TS" ]]; then
  info "docx-exporter: tsc --noEmit..."
  ( cd docx-exporter && npx tsc --noEmit ) || fail "docx-exporter/tsc упал."
fi

# --- 3. Prompts changed → нужен golden-set ---
STAGED_PROMPTS=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^backend/src/(prompts|knowledge|golden-set)/' || true)
if [[ -n "$STAGED_PROMPTS" ]]; then
  warn "Изменены prompts/knowledge/golden-set. Перед push прогонись:"
  warn "  cd backend && npx ts-node scripts/run-golden-set.ts"
  warn "CI всё равно проверит, но локально быстрее."
fi

# --- 4. Запрет force-push в main/prompts через pre-push (готовится отдельным хуком) ---
# см. scripts/pre-push.sh

info "pre-commit OK"
