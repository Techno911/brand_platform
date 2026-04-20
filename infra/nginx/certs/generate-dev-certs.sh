#!/usr/bin/env bash
# Генератор self-signed сертификата для bp-ingress-nginx (dev-окружение).
# В prod — Let's Encrypt через certbot на реальный домен `chirkov-bp.ru`.
set -euo pipefail
cd "$(dirname "$0")"

umask 077

# Единый self-signed для bp.local + localhost
openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -days 365 \
  -subj "/CN=bp.local" \
  -addext "subjectAltName=DNS:bp.local,DNS:localhost,IP:127.0.0.1" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth"

chmod 644 fullchain.pem
chmod 600 privkey.pem

echo "✓ Generated fullchain.pem / privkey.pem для bp-ingress-nginx (dev)"
echo "Добавь в /etc/hosts: 127.0.0.1 bp.local"
