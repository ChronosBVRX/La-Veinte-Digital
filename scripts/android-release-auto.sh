#!/usr/bin/env bash
# Automatiza bump + build + latest.json + deploy OTA Android
# Uso: ./scripts/android-release-auto.sh [patch|minor|major] ["notas"]
# Requiere: vercel login (una vez) o VERCEL_TOKEN en env, y JAVA_HOME al JBR
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-patch}"
NOTES="${2:-Corrección Registros biométricos: matcher tolerante para selección de periodo}"

GRADLE_FILE="android-app/app/build.gradle.kts"
LATEST="public/android/stable/latest.json"
APK_SRC_PATTERN="android-app/app/build/outputs/apk/debug/LaVeinteDigital-debug-v*.apk"
APK_DEST="public/LaVeinteDigital.apk"

# 1) Bump versionCode / versionName
VC=$(grep -E "versionCode = " "$GRADLE_FILE" | head -1 | grep -oE "[0-9]+")
VN=$(grep -E "versionName = " "$GRADLE_FILE" | head -1 | sed -E 's/.*"(.*)".*/\1/')
IFS='.' read -r MA MI PA <<< "$VN"
case "$BUMP" in
  major) MA=$((MA+1)); MI=0; PA=0 ;;
  minor) MI=$((MI+1)); PA=0 ;;
  patch) PA=$((PA+1)) ;;
  *) echo "BUMP debe ser patch|minor|major"; exit 1 ;;
esac
NEW_VN="$MA.$MI.$PA"
NEW_VC=$((VC+1))
echo "Bump $VN ($VC) -> $NEW_VN ($NEW_VC)"
sed -i -E "s/versionCode = $VC/versionCode = $NEW_VC/" "$GRADLE_FILE"
sed -i -E "s/versionName = \"$VN\"/versionName = \"$NEW_VN\"/" "$GRADLE_FILE"

# 2) Build debug (OTA usa debug)
echo "Compilando :app:assembleDebug..."
if [ -z "${JAVA_HOME:-}" ] && [ -d "/usr/lib/jvm/java-17-openjdk-amd64" ]; then export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"; fi
# Prefiere JBR si existe
if [ -d "/home/chronos/Android/sdk" ]; then
  for jbr in "/opt/android-studio/jbr" "/usr/local/android-studio/jbr" "$HOME/Android Studio/jbr"; do [ -d "$jbr" ] && export JAVA_HOME="$jbr" && break; done
fi
./android-app/gradlew -p android-app :app:assembleDebug -x test

# 3) Copiar APK a public/
APK_SRC=$(ls -t $APK_SRC_PATTERN | head -1)
echo "Copiando $APK_SRC -> $APK_DEST"
cp "$APK_SRC" "$APK_DEST"

# 4) SHA + size + latest.json
SHA=$(sha256sum "$APK_DEST" | awk '{print $1}' | tr 'A-Z' 'a-z')
SIZE=$(wc -c < "$APK_DEST" | tr -d ' ')
PUBLISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "SHA $SHA  SIZE $SIZE  AT $PUBLISHED_AT"

# Actualiza latest.json preservando mínimo/versionCode etc.
python3 - "$LATEST" "$NEW_VC" "$NEW_VN" "$SHA" "$SIZE" "$PUBLISHED_AT" "$NOTES" << 'PY'
import json, sys
path, vc, vn, sha, size, at, notes = sys.argv[1:]
d=json.load(open(path))
d["versionCode"]=int(vc)
d["versionName"]=vn
d["publishedAt"]=at
d["apk"]["sha256"]=sha
d["apk"]["size"]=int(size)
d["apk"]["url"]="https://la-veinte-digital.vercel.app/LaVeinteDigital.apk"
d["releaseNotes"]=[notes]
json.dump(d, open(path,"w"), indent=2, ensure_ascii=False)
print(json.dumps(d, indent=2, ensure_ascii=False))
PY

# 5) Commit local (no push automático para no romper si no hay token)
git add "$GRADLE_FILE" "android-app/app/src/main/java/com/laveintedigital/app/imss/biometric/BiometricDiscovery.kt" "$APK_DEST" "$LATEST" || true
if ! git diff --cached --quiet; then
  git commit -m "chore(android): release $NEW_VN ($NEW_VC) OTA

$NOTES" || true
  echo "Commit creado: $NEW_VN ($NEW_VC)"
else
  echo "Sin cambios para commit"
fi

# 6) Deploy si hay credenciales vercel
# Carga VERCEL_TOKEN de .env.local si no está en env
if [ -z "${VERCEL_TOKEN:-}" ] && [ -f ".env.local" ]; then
  VERCEL_TOKEN=$(grep -E "^VERCEL_TOKEN=" .env.local | sed -E 's/^VERCEL_TOKEN="?([^"]*)"?/\1/' | tail -1)
  export VERCEL_TOKEN
fi
if command -v vercel >/dev/null 2>&1 || npx vercel --version >/dev/null 2>&1; then
  if [ -f "$HOME/.vercel/auth.json" ] || [ -n "${VERCEL_TOKEN:-}" ]; then
    echo "Desplegando a Vercel..."
    if [ -n "${VERCEL_TOKEN:-}" ]; then
      npx vercel --prod --yes --token "$VERCEL_TOKEN"
    else
      npx vercel --prod --yes
    fi
    echo "Verifica: curl -s https://la-veinte-digital.vercel.app/android/stable/latest.json | grep versionName"
  else
    echo "Vercel no logueado. Ejecuta 'vercel login' o exporta VERCEL_TOKEN y re-ejecuta 'vercel --prod --yes'."
    echo "O haz git push origin main para que Vercel Git Integration despliegue."
  fi
else
  echo "Vercel CLI no instalado. Instala con 'npm i -g vercel' y luego 'vercel --prod --yes'."
fi
