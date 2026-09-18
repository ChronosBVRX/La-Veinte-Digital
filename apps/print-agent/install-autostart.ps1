# Script de instalación para inicio automático de La Veinte Print Agent con Windows
param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$AppName = "LaVeintePrintAgent"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$StartupFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$ShortcutPath = Join-Path $StartupFolder "$AppName.lnk"
$VbsPath = Join-Path $ScriptDir "launch-hidden.vbs"

if ($Uninstall) {
    if (Test-Path $ShortcutPath) {
        Remove-Item $ShortcutPath -Force
        Write-Host "✓ Inicio automático desinstalado correctamente." -ForegroundColor Yellow
    } else {
        Write-Host "No se encontró el acceso directo de inicio automático."
    }
    exit 0
}

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CONFIGURACIÓN DE INICIO AUTOMÁTICO EN WINDOWS  " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Crear script VBS para ejecución 100% en segundo plano sin ventana de consola
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$($ScriptDir -replace '\\', '\\')"
WshShell.Run "node src\index.mjs", 0, False
"@
Set-Content -Path $VbsPath -Value $VbsContent -Encoding ASCII

# 2. Crear acceso directo en la carpeta de Inicio de Windows
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "La Veinte Print Agent - Agente de impresión sindical"
$Shortcut.WindowStyle = 7 # Minimized
$Shortcut.Save()

Write-Host "`n✓ Acceso directo creado en: $ShortcutPath" -ForegroundColor Green
Write-Host "✓ La Veinte Print Agent iniciará automáticamente en segundo plano cada vez que enciendas la PC." -ForegroundColor Green
Write-Host "`nPara desinstalar en el futuro ejecuta:"
Write-Host "  powershell -File .\install-autostart.ps1 -Uninstall`n"
