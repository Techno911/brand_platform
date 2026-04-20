#!/usr/bin/env bash
# Git pre-push hook Brand Platform (INSIGHTS §5 delta-9).
# Запрет force-push в защищённые ветки: main, staging, prompts/*.
set -euo pipefail

RED="\033[0;31m"; NC="\033[0m"

protected="^refs/heads/(main|staging|prompts/.+)$"

while read -r local_ref local_sha remote_ref remote_sha; do
  if [[ "$remote_ref" =~ $protected ]]; then
    # Проверяем, является ли push force-push'ем (локальный sha не потомок удалённого)
    if [[ "$remote_sha" != "0000000000000000000000000000000000000000" ]]; then
      if ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
        echo -e "${RED}[pre-push] Force-push в $remote_ref запрещён политикой (INSIGHTS §5).${NC}" >&2
        echo "Если это действительно нужно — выполни через GitHub с ручным снятием protected branch." >&2
        exit 1
      fi
    fi
  fi
done

exit 0
