#!/bin/bash
# Lanzador de La Veinte Digital — arranca web app + motor de radio y abre el navegador.
REPO="/home/chronos/Escritorio/La Veinte"
LOG_DIR="$REPO/data/logs"
mkdir -p "$LOG_DIR"
export PATH="$HOME/.local/bin:$PATH"
export NODE_OPTIONS="--max-old-space-size=6144"

puerto_vivo() {
  curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$1" && return 0 || return 1
}

# 1) Sidecar del estudio de radio (idempotente: health-check + PID file)
if [ -f "$REPO/apps/radio-studio/sidecar/scripts/sidecarctl.sh" ]; then
  bash "$REPO/apps/radio-studio/sidecar/scripts/sidecarctl.sh" start >> "$LOG_DIR/sidecar-ctl.log" 2>&1
elif ! puerto_vivo 3977; then
  if [ -f "$REPO/apps/radio-studio/sidecar/dist/sidecar.js" ]; then
    nohup node --no-warnings "$REPO/apps/radio-studio/sidecar/dist/sidecar.js" \
      > "$LOG_DIR/sidecar.log" 2>&1 &
  fi
fi

# 2) Servidor web de producción (puerto 3000)
if ! puerto_vivo 3000; then
  cd "$REPO" || exit 1
  if [ ! -d "$REPO/.next" ]; then
    npm run build >> "$LOG_DIR/web-build.log" 2>&1
  fi
  nohup npm start > "$LOG_DIR/web-server.log" 2>&1 &
fi

# 3) Esperar a que la web responda (máx 60 s)
for i in $(seq 1 30); do
  puerto_vivo 3000 && break
  sleep 2
done

# 4) Abrir navegador
xdg-open "http://localhost:3000" >/dev/null 2>&1 &
