#!/usr/bin/env bash
# Генератор self-signed сертификатов для dev-окружения docx-exporter mTLS.
# В prod — использовать Smallstep / HashiCorp Vault PKI.

set -euo pipefail
cd "$(dirname "$0")"

umask 077

# CA
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 \
  -subj "/CN=BP Dev CA" -out ca.crt

# Server (docx-exporter)
openssl genrsa -out server.key 4096
openssl req -new -key server.key \
  -subj "/CN=bp-docx-exporter" \
  -out server.csr
cat > server.ext <<'EOF'
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = bp-docx-exporter
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 365 -sha256 -extfile server.ext

# Client (bp-backend)
openssl genrsa -out client.key 4096
openssl req -new -key client.key \
  -subj "/CN=bp-backend" \
  -out client.csr
cat > client.ext <<'EOF'
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature
extendedKeyUsage = clientAuth
EOF
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt -days 365 -sha256 -extfile client.ext

rm -f *.csr *.ext *.srl
chmod 644 *.crt
chmod 600 *.key

echo "✓ Generated ca.crt, server.crt, client.crt + keys"
