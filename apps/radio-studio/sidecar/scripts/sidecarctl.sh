#!/bin/bash
# sidecarctl — control idempotente del sidecar de AI Radio Studio.
# Uso: sidecarctl.sh start|stop|status|restart
set -u
REPO="/home/chronos/Escritorio/La Veinte"
PID_FILE="$REPO/data/tts/sidecar.pid"
LOG="$REPO/data/logs/sidecar.log"
PORT=3977
DIST="$REPO/apps/radio-studio/sidecar/dist/sidecar.js"

healthy() {
  curl -s --max-time 2 "http://127.0.0.1:$PORT/health" | grep -q '"ok": *true\|"ok":true' 
}

pid_vivo() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

case "${1:-status}" in
  status)
    if healthy; then echo "RUNNING pid=$(cat "$PID_FILE" 2>/dev/null || echo '?')"; else echo "DOWN"; exit 1; fi
    ;;
  start)
    # si el bundle cambió desde que arrancó la instancia, reiniciar para usarlo
    if healthy; then
      DIST_MTIME=$(stat -c %Y "$DIST" 2>/dev/null | cut -d. -f1)
      LIVE_BUNDLE=$(curl -s --max-time 2 "http://127.0.0.1:$PORT/health" | python3 -c "import json,sys; print(int(json.load(sys.stdin).get('bundle',0)//1000))" 2>/dev/null || echo 0)
      if [ -n "$DIST_MTIME" ] && [ "$LIVE_BUNDLE" != "$DIST_MTIME" ]; then
        echo "[ctl] bundle actualizado — reiniciando instancia…"
        "$0" stop
      else
        echo "ya corriendo (al día)"
        exit 0
      fi
    fi
    # limpiar pid file huérfano
    if pid_vivo; then echo "proceso con pid-file vivo pero sin health — matando $(cat "$PID_FILE")"; kill "$(cat "$PID_FILE")"; sleep 1; fi
    rm -f "$PID_FILE"
    mkdir -p "$(dirname "$LOG")"
    setsid nohup node --no-warnings "$DIST" >> "$LOG" 2>&1 &
    disown
    echo $! > "$PID_FILE"
    # esperar /health con timeout (nada de sleeps a ciegas)
    for i in $(seq 1 30); do
      healthy && { echo "READY pid=$(cat "$PID_FILE")"; exit 0; }
      sleep 0.5
    done
    echo "ERROR: no respondió /health en 15 s"; tail -5 "$LOG"; exit 1
    ;;
  stop)
    if ! pid_vivo && ! healthy; then echo "no estaba corriendo"; rm -f "$PID_FILE"; exit 0; fi
    PID="$(cat "$PID_FILE" 2>/dev/null || pgrep -f 'dist/[s]idecar.js' | head -1)"
    [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null
    for i in $(seq 1 20); do healthy || break; sleep 0.5; done
    if healthy; then kill -9 "$PID" 2>/dev/null; sleep 0.5; fi
    rm -f "$PID_FILE"
    echo "detenido"
    ;;
  restart) "$0" stop; "$0" start ;;
  *) echo "uso: $0 start|stop|status|restart"; exit 2 ;;
esac
