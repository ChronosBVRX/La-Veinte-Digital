param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$piperExe = Join-Path $RepoRoot "tools\piper\piper\piper.exe"
$piperRoot = Join-Path $RepoRoot "tools\piper"
$modelDir = Join-Path $RepoRoot "data\tts\models\piper\es_MX-ald-medium"
$model = Join-Path $modelDir "es_MX-ald-medium.onnx"
$config = Join-Path $modelDir "es_MX-ald-medium.onnx.json"
$refDir = Join-Path $RepoRoot "data\tts\ref"
$target = Join-Path $refDir "narrador.wav"
$raw = Join-Path $refDir "narrador-piper-ald-raw.wav"

New-Item -ItemType Directory -Force -Path $piperRoot,$modelDir,$refDir | Out-Null

if (!(Test-Path $piperExe)) {
  $zip = Join-Path $env:TEMP "piper_windows_amd64.zip"
  Invoke-WebRequest `
    -Uri "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip" `
    -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $piperRoot -Force
}

if (!(Test-Path $model)) {
  Invoke-WebRequest `
    -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx?download=true" `
    -OutFile $model
}

if (!(Test-Path $config)) {
  Invoke-WebRequest `
    -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx.json?download=true" `
    -OutFile $config
}

if (Test-Path $target) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item -LiteralPath $target -Destination (Join-Path $refDir "narrador-previous-backup-$stamp.wav")
}

$text = @"
La Veinte Digital presenta informacion laboral verificada para trabajadoras y trabajadores del Instituto Mexicano del Seguro Social.
La inteligencia artificial ayuda a ordenar la conversacion. La fuente siempre sera el documento.
Cuando escuche una cifra, un plazo, una clausula o un articulo, recuerde: debe existir evidencia local, verificable y citada.
"@

$text | & $piperExe --model $model --output_file $raw

ffmpeg -hide_banner -loglevel error -y -i $raw `
  -af "asetrate=20947,aresample=22050,highpass=f=65,lowpass=f=7600,loudnorm=I=-20:TP=-3:LRA=8" `
  -ar 22050 -ac 1 $target

$hash = Get-FileHash -Algorithm SHA256 $target
[pscustomobject]@{
  Voice = "NARRADOR"
  Source = "piper:rhasspy/es_MX-ald-medium"
  Path = $target
  Sha256 = $hash.Hash
}
