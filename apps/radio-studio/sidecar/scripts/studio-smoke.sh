#!/bin/bash
# studio:smoke — prueba rápida del estudio (<2 min, sin TTS real).
# 1. sidecar sano e idempotente
# 2. /generate mock con fixture de 8 turnos
# 3. /master mock (mixer+crossfade+trim) sobre WAVs cacheados
# 4. QA report presente
set -u
REPO="/home/chronos/Escritorio/La Veinte"
CTL="$REPO/apps/radio-studio/sidecar/scripts/sidecarctl.sh"
FIX="$REPO/apps/radio-studio/sidecar/fixtures"

"$CTL" start || exit 1

TURNS=$(python3 -c "
import json
d = json.load(open('$FIX/dev-script.json'))
print(json.dumps(d['turns']))
")
VOCES='{"EDUARDO":"A","ANDREA":"B","NARRADOR":"N"}'

echo "── 1/3 generate (mock) ──"
BLOQUES=$(echo "$TURNS" | python3 -c "
import json,sys
ts = json.load(sys.stdin)
print(json.dumps([{'id':t['id'],'texto':t['text'],'locutor':t['speaker']} for t in ts]))
")
R=$(curl -s --max-time 30 -X POST http://127.0.0.1:3977/generate -H 'Content-Type: application/json' \
  -d "{\"bloques\":$BLOQUES,\"voces\":$VOCES,\"tema\":\"dev-smoke\",\"mock\":true}")
echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('mock') or d.get('iniciado'), 'sin mock'" || { echo "FALLO generate: $R"; exit 1; }
echo "OK"

echo "── 2/3 master (mock: mixer+QA) ──"
M=$(curl -s --max-time 120 -X POST http://127.0.0.1:3977/master -H 'Content-Type: application/json' \
  -d "{\"turns\":$TURNS,\"voces\":$VOCES,\"mock\":true,\"kbps\":192,\"ducking\":true,\"bed\":\"auto\",\"jingle\":\"auto\"}")
echo "$M" | grep -q '"master"' || { echo "FALLO master: $M"; exit 1; }

echo "── 3/3 verificaciones ──"
echo "$M" | python3 -c "
import json, sys
d = json.load(sys.stdin)
qa = d.get('qa') or {}
assert d['master'], 'sin master'
assert d['turnos'] >= 8, f'turnos insuficientes: {d[\"turnos\"]}'
assert qa.get('lufsIntegrado') is not None, 'LUFS no medido'
assert qa.get('firewallValeria') == [], 'firewall violado'
print('MASTER:', d['master'])
print('turnos mezclados:', d['turnos'], '| LUFS:', qa['lufsIntegrado'], '| TP:', qa['truePeakDbfs'])
print('silencios>1.5s:', qa['silenciosMayores1500ms'], '| duplicados texto:', qa['bloquesDuplicados'])
print('trim por voz:', d.get('trimPorVoz'))
print('SMOKE OK ✓')
"
