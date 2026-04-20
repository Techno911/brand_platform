# mTLS certificates для docx-exporter

INSIGHTS §5 delta-3: backend ↔ docx-exporter общаются ТОЛЬКО через mTLS.
Контейнер `bp-docx-exporter` запускается в read-only режиме и не делает сетевых
запросов наружу. Единственный способ достучаться до него — через docker network
`bp-internal` с client-сертификатом, выданным от `ca.crt`.

## Локально (dev)

```bash
# Внутри ./infra/exporter/certs/
./generate-dev-certs.sh
```

Скрипт создаёт самоподписанные:

- `ca.crt` / `ca.key` — внутренний CA
- `server.crt` / `server.key` — для docx-exporter (DNS: bp-docx-exporter, localhost)
- `client.crt` / `client.key` — для bp-backend

Прописать в `.env`:

```
DOCX_TLS_CERT=/certs/server.crt
DOCX_TLS_KEY=/certs/server.key
DOCX_TLS_CLIENT_CA=/certs/ca.crt
DOCX_EXPORTER_CLIENT_CERT=/certs/client.crt
DOCX_EXPORTER_CLIENT_KEY=/certs/client.key
DOCX_EXPORTER_CA_CERT=/certs/ca.crt
DOCX_EXPORTER_URL=https://bp-docx-exporter:4000
```

## Prod

CA, server и client сертификаты выдаются через внутренний PKI (Smallstep/HashiCorp
Vault PKI). Ротация раз в 90 дней. Private keys не попадают в git — только в
Docker/K8s secret store.
