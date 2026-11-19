# 🏥 La 20 Digital — Edición Portátil para PC
### *Navegador IMSS, Tarjetón Digital, Checadas Biométricas y Documentos en USB*

Esta aplicación de escritorio basada en **Electron** empaqueta un Chromium propio y está diseñada para ejecutarse de forma **100% portátil** desde una memoria USB en cualquier computadora con Windows.

---

## 🔒 Arquitectura Portátil para Memoria USB

Todos los datos se guardan estrictamente dentro de la misma memoria USB en carpetas con nombres limpios y transparentes para no despertar sospechas ni alertas en equipos institucionales:

```text
[Unidad USB]
└── La 20 Digital/
    ├── La 20 Digital Portable.exe
    └── Datos/
        ├── Perfil/         -> Sesión, cookies y caché de navegación aislados en la USB
        ├── Documentos/     -> Archivos respaldados físicamente
        │     ├── Tarjetones/   (PDFs descargados automáticamente)
        │     ├── Escritos/     (Oficios y formatos generados en La 20)
        │     └── Biometricos/  (Snapshots de registros de asistencia y checadas)
        └── Seguridad/      -> Bóveda cifrada con PIN Maestro (AES-256-GCM + PBKDF2)
```

---

## 🚀 Funcionalidades Integradas (Idénticas a Android)

1. **🏥 La 20 Digital:** Carga la plataforma oficial inyectando el puente nativo `window.LaVeinteApp`, activando todas las opciones de escritorio.
2. **💳 Tarjetón IMSS (`rh.imss.gob.mx`):**
   - Inyección automática de matrícula, delegación y contraseña desde la bóveda segura.
   - Intercepción automática del reporte en ventana emergente (`wfrReporteTarjeton.aspx`).
   - Descarga directa del archivo PDF a la carpeta `Datos/Documentos/Tarjetones/`.
3. **⏱️ Checadas Biométricas (`tuperfil.imss.gob.mx`):**
   - Auto-login con credenciales guardadas.
   - Consulta y extracción de registros de entrada, salida, retardos y omisiones.
   - Respaldo automático de checadas en `Datos/Documentos/Biometricos/`.
4. **📂 Mis Documentos:** Explorador nativo de archivos en la USB con visor, fecha, peso y botón para abrir o imprimir en Windows.
5. **🌐 Navegador Libre:** Mini-navegador con barra de direcciones para consultar cualquier sitio web (Google, YouTube, etc.) eliminando las restricciones de cabeceras (`X-Frame-Options` y CSP).
6. **🔑 Seguridad por PIN Maestro:** Protección de la aplicación y cifrado de las credenciales IMSS con un PIN de 4 a 8 dígitos definido por el usuario.

---

## 🛠️ Comandos de Desarrollo y Compilación

Desde la carpeta `desktop-app/`:

```bash
# Compilar TypeScript y copiar interfaz
npm run build

# Probar la aplicación en modo desarrollo
npm start

# Generar el ejecutable portable para la memoria USB (.exe independiente)
npm run package:portable
```

El archivo resultante se generará en la carpeta `desktop-app/dist-package/` listo para copiarse a cualquier memoria USB.
