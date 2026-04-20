#!/usr/bin/env bash
# Устанавливает git hooks Brand Platform.
# Запуск: ./scripts/install-git-hooks.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

install_hook() {
  local name=$1
  local src="$REPO_ROOT/scripts/$name.sh"
  local dst="$HOOKS_DIR/$name"
  cp "$src" "$dst"
  chmod +x "$dst"
  echo "  ✓ $name → $dst"
}

mkdir -p "$HOOKS_DIR"
install_hook pre-commit
install_hook pre-push

echo ""
echo "Готово. Хуки работают. Напомни команде установить gitleaks:"
echo "  macOS:   brew install gitleaks"
echo "  Linux:   см. https://github.com/gitleaks/gitleaks/releases"
