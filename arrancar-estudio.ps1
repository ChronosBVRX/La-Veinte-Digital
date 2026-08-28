# Arranque de AI Radio Studio (producción local)
# 1. ACE-Step 1.5 (motor de música local) si no está corriendo
# 2. Sidecar (TTS Qwen Base clone local + corpus + música) con Ollama (editorial) 
# 3. Vite dev de la UI (radio-studio) en http://localhost:1420

$ErrorActionPreference = "Continue"
$REPO = $PSScriptRoot
$OLLAMA_BIN = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
$OLLAMA_MODEL = "qwen3.5:9b"

Write-Host "== AI Radio Studio — arranque ==" -ForegroundColor Cyan
Write-Host "[editorial] Motor local qwen3.5:9b vía Ollama (100% local, sin APIs remotas)." -ForegroundColor Green

# --- 1. ACE-Step (música) ---
$aceRunning = $false
try { Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -TimeoutSec 3 | Out-Null; $aceRunning = $true } catch { }
if ($aceRunning) {
    Write-Host "[1/3] ACE-Step ya esta corriendo (127.0.0.1:8001)." -ForegroundColor Green
} else {
    Write-Host "[1/3] Arrancando ACE-Step (musica local)…" -ForegroundColor Yellow
    $aceLog = Join-Path $REPO "data\tts\ace-step-api.log"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c","set PATH=%USERPROFILE%\.local\bin;%PATH%&& cd /d `"$REPO\tools\ACE-Step-1.5`"&& uv run --no-sync acestep-api > `"$aceLog`" 2>&1" -WindowStyle Hidden
    $ok = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 5
        try { Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -TimeoutSec 3 | Out-Null; $ok = $true; break } catch { }
    }
    if ($ok) { Write-Host "      ACE-Step listo en 127.0.0.1:8001." -ForegroundColor Green } else { Write-Host "      WARN: ACE-Step no respondio. Log: $aceLog" -ForegroundColor Red }
}

# --- 2. Sidecar ---
$sideRunning = $false
try { Invoke-RestMethod -Uri "http://127.0.0.1:3977/status" -TimeoutSec 3 | Out-Null; $sideRunning = $true } catch { }
if ($sideRunning) {
    Write-Host "[2/3] Sidecar ya esta corriendo (127.0.0.1:3977)." -ForegroundColor Green
} else {
    Write-Host "[2/3] Arrancando sidecar (TTS + corpus + música + editorial local)…" -ForegroundColor Yellow
    $log = Join-Path $env:TEMP "radio-studio-sidecar.log"
    $envChain = "set OLLAMA_URL=http://127.0.0.1:11434&& set OLLAMA_MODEL=$OLLAMA_MODEL"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c","$envChain&& npm run dev > `"$log`" 2>&1" -WorkingDirectory (Join-Path $REPO "apps\radio-studio\sidecar") -WindowStyle Hidden
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        try { Invoke-RestMethod -Uri "http://127.0.0.1:3977/status" -TimeoutSec 3 | Out-Null; $ok = $true; break } catch { }
    }
    if ($ok) { Write-Host "      Sidecar listo en 127.0.0.1:3977." -ForegroundColor Green } else { Write-Host "      WARN: el sidecar no respondio. Log: $log" -ForegroundColor Red }
}

# --- 3. Vite dev ---
Write-Host "[3/3] Abriendo la interfaz en http://localhost:1420 …" -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev" -WorkingDirectory (Join-Path $REPO "apps\radio-studio") -WindowStyle Hidden
Start-Sleep -Seconds 5
Start-Process "http://localhost:1420"
Write-Host "Listo. Cierra la ventana del navegador cuando termines." -ForegroundColor Green
