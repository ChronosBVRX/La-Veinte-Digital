# 🖨️ La Veinte Print Agent — Delegación XXI

Agente nativo de Windows para la **Impresión Automática y Silenciosa** de documentos sindicales (Oficio + Solicitud de Licencia en paquete conjunto Carta).

---

## Características Principales

1. **Impresión 100% Silenciosa:** Sin cuadros de diálogo ni ventanas emergentes; interactúa directamente con el spooler de Windows.
2. **Cero Credenciales de Usuario:** Autenticación de máquina exclusiva mediante **Station Token** con permisos restringidos.
3. **Cifrado Seguro:** El token se almacena cifrado en la PC utilizando **Windows DPAPI** (`DataProtectionScope.CurrentUser`).
4. **Sincronización:** Escucha en tiempo real vía Supabase Realtime con fallback por polling cada 12 segundos.
5. **Reclamo Atómico:** Previene impresiones dobles mediante bloqueo en PostgreSQL (`queued` → `claimed`).
6. **Integridad Criptográfica:** Valida el checksum SHA-256 del PDF antes de enviar a la impresora.
7. **Arranque Automático:** Script para iniciar con Windows en segundo plano.

---

## Instalación y Configuración

### 1. Requisitos previos
- Windows 10 o Windows 11.
- Node.js v20 o superior instalado.

### 2. Instalar dependencias
En la carpeta `apps/print-agent`:
```powershell
npm install
```

### 3. Configuración asistida
```powershell
npm run setup
```
El asistente interactivo te solicitará:
- La URL del servidor (ej. `http://localhost:3000` o `https://la20.com.mx`).
- El **Token Secreto** de la estación (generado en La Veinte Digital por un administrador en `/representacion/impresion`).
- Te mostrará la lista de impresoras instaladas en Windows para elegir la correspondiente (ej. `HP LaserJet Pro M501dn (A7CD7F)`).

### 4. Probar en primer plano
```powershell
npm start
```
Observarás la confirmación de conexión y el reporte de latido cada 20 segundos.

### 5. Configurar inicio automático con Windows
Para que el agente arranque solo cada vez que se enciende la computadora:
```powershell
powershell -ExecutionPolicy Bypass -File .\install-autostart.ps1
```
