# PUENTE Windows → Linux (La Veinte Digital)

## ESTADO ACTUAL (2026-08-23): el stack TTS/música YA FUNCIONA en Linux — el puente es OPCIONAL
- ✅ Chatterbox LatAm operativo en RTX 3060 (venv en `data/tts/venv`, torch 2.6.0+cu126).
- ✅ `t3_es_mx_latam.safetensors` descargado de HuggingFace (`ResembleAI/Chatterbox-Multilingual-es-mx-latam`).
- ✅ ACE-Step 1.5 con código oficial + pesos re-descargados; API genera música OK.
- ✅ SSH server activo en esta máquina (192.168.1.126, usuario `chronos`).
- El puente SOLO queda para rescatar activos editoriales únicos de Windows: masters, previews, jobs, benchmarks, casting.

## Contexto
- **Este equipo (Linux)**: clon fresco de `ChronosBVRX/La-Veinte-Digital` en `/home/chronos/Escritorio/La Veinte`.
  - ✅ Web app compila, 906 tests OK, secretos restaurados, corpus normativa COMPLETO (71 docs / 18,761 chunks).
  - GPU: NVIDIA RTX 3060. Node v22.18.0 en `~/.local/bin`. ffmpeg estático en `~/.local/bin/ffmpeg`.
- **Equipo origen (Windows)**: máquina original con los activos pesados locales NO versionados en git.

## Objetivo
Transferir de Windows a Linux SOLO lo que no se puede regenerar fácilmente o que ahorra horas de descarga:

### A. Modelos TTS/voz — YA NO NECESARIO (re-descargados de HF)
```
data\tts\models\              → modelos locales (t3_es_mx_latam.safetensors, etc.)
%USERPROFILE%\.cache\huggingface\hub\models--resembleai--chatterbox*   → si existe
tools\piper\**\*.onnx + *.json (SOLO voces ONNX: es_MX-claude-high, es_MX-ald-medium,
                                es_ES-davefx-medium, es_AR-daniela-high)
```
NOTA: `data\tts\ref\*.wav` y `data\tts\music\bed|jingle-uniforme-vivo.wav` YA están en git — no enviar.

### B. ACE-Step (prioridad MEDIA; alternativamente re-descargable de HuggingFace)
```
tools\ACE-Step-1.5\checks\    → checkpoints/modelos (NO el .venv)
tools\ACE-Step-1.5\.env       → perfil de configuración
```
NO enviar: `tools\ACE-Step-1.5\.venv`, `node_modules`, caches.

### C. Producción editorial (prioridad ALTA, único e irremplazable)
```
data\tts\masters\             → masters MP3/WAV producidos
data\tts\previews\
data\tts\jobs\
data\tts\benchmark\
data\normativa\pilotos\
apps\radio-studio\**\producciones\  (si existe fuera de git)
```

### D. NO enviar nunca
`data\normativa\` (ya regenerado completo aquí), `node_modules`, `.venv`, `public\vendor`,
instaladores, `src-tauri\target`.

## Cómo conectar (Linux ya tendrá sshd tras el paso 1 del usuario)

1. Desde Windows, probar: `ssh chronos@<IP_LINUX>` (la IP la da el usuario; puerto 22).
2. Autenticación: copiar la pública del agente Windows a
   `/home/chronos/.ssh/authorized_keys` (chmod 700 ~/.ssh, 600 authorized_keys),
   o usar password la primera vez.
3. Transferencia preferida: `scp` o `rsync -av --partial` (rsync vía WSL/cwRsync;
   si no hay rsync, `tar -czf - <rutas> | ssh chronos@IP "tar -xzf - -C '/home/chronos/Escritorio/La Veinte'"`).
4. Respetar las rutas destino EXACTAS dentro del repo Linux:
   `/home/chronos/Escritorio/La Veinte/<misma-ruta-relativa>`
   (los HF cache van a `/home/chronos/.cache/huggingface/...`).
5. Al terminar, validar en Linux:
   - `ls -la "data/tts/models"` y tamaños coherentes
   - `sha256sum` de los .safetensors vs Windows (si el agente puede comparar)

## Reglas
- Serial y sin prisa si se usa red WiFi; los safetensors son grandes.
- No tocar nada dentro de `src/`, `resources/`, ni borrar nada existente en Linux.
- Si un directorio de Windows no existe, saltarlo y reportarlo, no inventar rutas.
