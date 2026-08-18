$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$refDir = Join-Path $repo "data\tts\ref"
$raw = Join-Path $refDir "narrador-raul-raw.wav"
$out = Join-Path $refDir "narrador.wav"
$backup = Join-Path $refDir ("narrador-chillon-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".wav")

New-Item -ItemType Directory -Force -Path $refDir | Out-Null
if (Test-Path -LiteralPath $out) {
  Copy-Item -LiteralPath $out -Destination $backup
}

Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $speaker.GetInstalledVoices() |
  Where-Object { $_.VoiceInfo.Culture.Name -eq "es-MX" -and $_.VoiceInfo.Gender -eq "Male" } |
  Select-Object -First 1
if ($null -eq $voice) {
  $voice = $speaker.GetInstalledVoices() |
    Where-Object { $_.VoiceInfo.Gender -eq "Male" } |
    Select-Object -First 1
}
if ($null -eq $voice) {
  throw "No hay una voz masculina instalada para construir una referencia seria del narrador."
}
$speaker.SelectVoice($voice.VoiceInfo.Name)
$speaker.Rate = -2
$speaker.Volume = 100
$speaker.SetOutputToWaveFile($raw)
$speaker.Speak("La Veinte Digital. Voz institucional del programa. Este contenido se presenta con seriedad, claridad y respeto para las personas trabajadoras del Instituto Mexicano del Seguro Social. La fuente siempre será el documento, y cada caso individual puede requerir revisión específica.")
$speaker.Dispose()

$ffmpeg = Join-Path $env:LOCALAPPDATA "ffmpeg\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe"
if (!(Test-Path -LiteralPath $ffmpeg)) {
  $ffmpeg = "ffmpeg"
}

& $ffmpeg -y -i $raw -af "asetrate=20727,aresample=22050,highpass=f=75,lowpass=f=7600,loudnorm=I=-20:TP=-3:LRA=9" -ar 22050 $out | Out-Null
Remove-Item -LiteralPath $raw -Force

Get-FileHash -Algorithm SHA256 -LiteralPath $out | Select-Object Hash, Path
