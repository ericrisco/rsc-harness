#!/usr/bin/env bash
# Smoke-test del puente: el MCP de DBHub responde, autentica y SOLO expone lo esperado.
# Copia esta carpeta a 01-TOOLS/<PROGRAMA>/ del arnés (p. ej. 01-TOOLS/SAGE_50/).
# Uso: ./test_connection.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PATH="$SCRIPT_DIR/.env"
[ -f "$ENV_PATH" ] || { echo "ERROR: falta $ENV_PATH" >&2; exit 1; }
set -a; source "$ENV_PATH"; set +a
: "${ERP_MCP_URL:?ERP_MCP_URL vacío en $ENV_PATH}"
: "${ERP_MCP_TOKEN:?ERP_MCP_TOKEN vacío en $ENV_PATH}"

rpc() {
  curl -fsS -m 30 -X POST "$ERP_MCP_URL" \
    -H "Authorization: Bearer ${ERP_MCP_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$1" | sed -n 's/^data: //p;/^{/p' | tail -1
}

rpc '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test_connection","version":"1.0"}}}' >/dev/null \
  || { echo "ERROR: el MCP no responde o el token no vale" >&2; exit 1; }
LISTA="$(rpc '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')"

LISTA="$LISTA" python3 -c '
import json, os, sys
tools = [t["name"] for t in json.loads(os.environ["LISTA"])["result"]["tools"]]
print("Herramientas:", ", ".join(tools))
raras = [t for t in tools if t not in {"execute_sql", "search_objects", "ventas_por_dia", "cobros_pendientes", "stock_bajo_minimos"}]
if raras:
    print("AVISO: herramientas no previstas en el kit:", ", ".join(raras), file=sys.stderr)
print("OK — puente accesible. Recuerda: la prueba de solo lectura (03-prueba-solo-lectura.sql) tiene que dar OK en el servidor.")
'
