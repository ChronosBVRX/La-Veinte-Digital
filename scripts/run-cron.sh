#!/usr/bin/env bash
set -e

CRON_NAME="$1"
if [ -z "$CRON_NAME" ]; then
  echo "Uso: $0 <agenda-reminders|push-campaigns>"
  exit 1
fi

ENV_FILE="/opt/laveinte-app/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE no encontrado"
  exit 1
fi

CRON_SECRET=$(grep -E "^CRON_SECRET=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | tr -d "\"'")
LOG_FILE="/var/log/laveinte-crons.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "[$TIMESTAMP] Ejecutando cron: $CRON_NAME..." >> "$LOG_FILE"

RESP=$(curl -sS -g -w "\n%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:3000/api/cron/$CRON_NAME" 2>> "$LOG_FILE")

HTTP_CODE=$(echo "$RESP" | tail -n 1)
BODY=$(echo "$RESP" | sed '$d')

echo "[$TIMESTAMP] $CRON_NAME resultado: HTTP $HTTP_CODE - $BODY" >> "$LOG_FILE"
echo "HTTP $HTTP_CODE: $BODY"
