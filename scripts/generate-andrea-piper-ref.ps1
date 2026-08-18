param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$piperExe = Join-Path $RepoRoot "tools\piper\piper\piper.exe"
$modelDir = Join-Path $RepoRoot "data\tts\models\piper\es_MX-claude-high"
$model = Join-Path $modelDir "es_MX-claude-high.onnx"
$config = Join-Path $modelDir "es_MX-claude-high.onnx.json"
$refDir = Join-Path $RepoRoot "data\tts\ref"
$target = Join-Path $refDir "mariana.wav"
$raw = Join-Path $refDir "andrea-piper-claude-raw.wav"

New-Item -ItemType Directory -Force -Path $modelDir,$refDir | Out-Null

if (!(Test-Path $piperExe)) {
  $piperRoot = Join-Path $RepoRoot "tools\piper"
  $zip = Join-Path $env:TEMP "piper_windows_amd64.zip"
  New-Item -ItemType Directory -Force -Path $piperRoot | Out-Null
  Invoke-WebRequest `
    -Uri "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip" `
    -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $piperRoot -Force
}

if (!(Test-Path $model)) {
  Invoke-WebRequest `
    -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx?download=true" `
    -OutFile $model
}

if (!(Test-Path $config)) {
  Invoke-WebRequest `
    -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx.json?download=true" `
    -OutFile $config
}

if (Test-Path $target) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item -LiteralPath $target -Destination (Join-Path $refDir "mariana-sabina-backup-$stamp.wav")
}

$text = @"
Hola, soy Andrea. En La Veinte Digital vamos a explicar los derechos laborales con claridad, ritmo y ejemplos reales.
Me gusta preguntar lo que muchas personas piensan, pero no siempre se atreven a decir.
La idea es que cada episodio se sienta cercano, util, bien documentado y facil de seguir.
"@

$text | & $piperExe --model $model --output_file $raw

ffmpeg -hide_banner -loglevel error -y -i $raw `
  -af "highpass=f=70,lowpass=f=7800,loudnorm=I=-20:TP=-3:LRA=8" `
  -ar 22050 -ac 1 $target

$hash = Get-FileHash -Algorithm SHA256 $target
[pscustomobject]@{
  Voice = "ANDREA"
  Source = "piper:rhasspy/es_MX-claude-high"
  Path = $target
  Sha256 = $hash.Hash
}
