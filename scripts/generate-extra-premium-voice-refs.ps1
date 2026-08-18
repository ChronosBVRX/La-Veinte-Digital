param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$piperExe = Join-Path $RepoRoot "tools\piper\piper\piper.exe"
$piperRoot = Join-Path $RepoRoot "tools\piper"
$refDir = Join-Path $RepoRoot "data\tts\ref"
New-Item -ItemType Directory -Force -Path $piperRoot,$refDir | Out-Null

if (!(Test-Path $piperExe)) {
  $zip = Join-Path $env:TEMP "piper_windows_amd64.zip"
  Invoke-WebRequest `
    -Uri "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip" `
    -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $piperRoot -Force
}

function Ensure-Model {
  param(
    [string]$Folder,
    [string]$File,
    [string]$ModelUrl,
    [string]$ConfigUrl
  )
  $modelDir = Join-Path $RepoRoot "data\tts\models\piper\$Folder"
  New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
  $model = Join-Path $modelDir $File
  $config = Join-Path $modelDir "$File.json"
  if (!(Test-Path $model)) { Invoke-WebRequest -Uri $ModelUrl -OutFile $model }
  if (!(Test-Path $config)) { Invoke-WebRequest -Uri $ConfigUrl -OutFile $config }
  return $model
}

function Backup-IfExists {
  param([string]$Path, [string]$Prefix)
  if (Test-Path $Path) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item -LiteralPath $Path -Destination (Join-Path $refDir "$Prefix-backup-$stamp.wav")
  }
}

$corresponsalModel = Ensure-Model `
  -Folder "es_ES-davefx-medium" `
  -File "es_ES-davefx-medium.onnx" `
  -ModelUrl "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx?download=true" `
  -ConfigUrl "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json?download=true"

$comercialModel = Ensure-Model `
  -Folder "es_AR-daniela-high" `
  -File "es_AR-daniela-high.onnx" `
  -ModelUrl "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx?download=true" `
  -ConfigUrl "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx.json?download=true"

$corresponsalTarget = Join-Path $refDir "rodrigo.wav"
$corresponsalRaw = Join-Path $refDir "rodrigo-piper-davefx-raw.wav"
Backup-IfExists -Path $corresponsalTarget -Prefix "rodrigo"
$corresponsalText = @"
Soy Rodrigo Torres, corresponsal de La Veinte Digital. Estoy en contacto con trabajadoras y trabajadores para traer reportes claros desde las unidades, los hospitales y las oficinas.
Cuando entre al programa, mi trabajo sera poner contexto de campo, contar que se esta viviendo y separar hechos de rumores.
"@
$corresponsalText | & $piperExe --model $corresponsalModel --output_file $corresponsalRaw
ffmpeg -hide_banner -loglevel error -y -i $corresponsalRaw `
  -af "asetrate=21450,aresample=22050,highpass=f=70,lowpass=f=7600,loudnorm=I=-20:TP=-3:LRA=8" `
  -ar 22050 -ac 1 $corresponsalTarget

$comercialTarget = Join-Path $refDir "valeria.wav"
$comercialRaw = Join-Path $refDir "valeria-piper-daniela-raw.wav"
Backup-IfExists -Path $comercialTarget -Prefix "valeria"
$comercialText = @"
Soy Valeria Soto, voz comercial de La Veinte Digital. Cuando haya patrocinio, mi intervencion debe sonar clara, breve y profesional.
Los comerciales se identifican como espacios separados del contenido editorial, con tono amable, energia positiva y cierre limpio.
"@
$comercialText | & $piperExe --model $comercialModel --output_file $comercialRaw
ffmpeg -hide_banner -loglevel error -y -i $comercialRaw `
  -af "highpass=f=70,lowpass=f=7800,loudnorm=I=-20:TP=-3:LRA=8" `
  -ar 22050 -ac 1 $comercialTarget

@(
  [pscustomobject]@{
    Voice = "RODRIGO"
    Role = "corresponsal"
    Source = "piper:rhasspy/es_ES-davefx-medium:correspondent"
    Path = $corresponsalTarget
    Sha256 = (Get-FileHash -Algorithm SHA256 $corresponsalTarget).Hash
  },
  [pscustomobject]@{
    Voice = "VALERIA"
    Role = "comercial"
    Source = "piper:rhasspy/es_AR-daniela-high:commercial"
    Path = $comercialTarget
    Sha256 = (Get-FileHash -Algorithm SHA256 $comercialTarget).Hash
  }
)
