# Reporte de pruebas — Play compliance 2026-09-06

Rama: `fix/google-play-government-info-compliance`. Baseline: `a3e5792`
(prod verificado vía `GET /api/health` → `{"status":"ok","commitSha":"a3e5792"}`).

## Web

| Comando | Resultado | Duración | Detalle |
|---|---|---|---|
| `npm run typecheck` | PASS, 0 errores | ~30 s | — |
| `npx eslint` (16 archivos del delta) | 0 errores, 3 warnings preexistentes (`<img>` en `EscritosResult`, no tocados) | ~40 s | — |
| `npm test` (vitest run) | PASS — 165 archivos, 1661 tests pasados, 10 omitidos (env) | 163 s | +1 archivo / +9 tests vs baseline (164/1652); 0 fallos |
| `npm run build` | PASS — compilado en 49 s | ~60 s | `/informacion-y-fuentes` prerenderizada estática (○) |
| Auditoría de enlaces (`GET` + redirects) | 6/7 HTTP 200 | ~60 s | `imss.gob.mx/` 200, `gob.mx/imss` 200, `diputados …/index.htm` 200, `LFT.pdf` 200, `LSS.pdf` 200, `CCT-2025-2027.pdf` 200; `dof.gob.mx/` 000 desde este sandbox (DNS OK, timeout/WAF; URL canónica oficial conservada, verificar desde otra red) |

## Android

| Comando | Resultado |
|---|---|
| `:app:testPlayDebugUnitTest --tests SdkConfigConsistencyTest` | PASS (1/1, 0 fallos): compileSdk 36, minSdk 29, targetSdk 36, versionCode 205 |
| `:app:assemblePlayDebug` | BUILD SUCCESSFUL (22 s) |

## Regresión funcional (por suite, sin cambios de fórmulas ni contratos)

Login/OAuth, home, menú lateral, perfil, tarjetón (100% local), documentos,
escritos (manual + IA + export), visores/PDF, compartir/imprimir, agenda y
recordatorios, calculadoras, chatbot y citas, puentes Android, offline: cubiertos
por la suite en verde (165 archivos). Sin migraciones, sin cambios de storage keys,
rutas API ni bridges.

## Pendiente de hardware (bloqueado sin dispositivo/emulador con KVM)

- Capturas reales de las 6 pantallas (incl. “Información y fuentes”).
- Instalación del AAB 205 en API 29/33/35/36, insets/edge-to-edge, Custom Tabs,
  cámara, notificaciones, descargas, Atrás predictivo.
- `bundlePlayRelease` firmado (requiere `LAVEINTE_KEYSTORE_*` en CI) + SHA-256.
- Subida a Play Console (requiere 2FA del propietario).

## Rollback

Cada commit es revertible por separado (`git revert`). Rollback total:
`git checkout main` (esta rama no toca `main`; tag de seguridad
`stable-pre-play-compliance-20260906-a3e5792` sobre `a3e5792`). Sin migraciones
de BD en este delta: nada que revertir en Supabase.
