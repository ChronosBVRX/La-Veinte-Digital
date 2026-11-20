import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface PortablePaths {
  rootDir: string;
  dataDir: string;
  profileDir: string;
  documentsDir: string;
  tarjetonesDir: string;
  escritosDir: string;
  biometricosDir: string;
  securityDir: string;
}

/**
 * Resuelve las rutas de almacenamiento portátil.
 *
 * En modo portátil (ejecutado desde USB), todos los datos se concentran en:
 * [Carpeta de la App]/Datos/
 *   ├── Perfil/        -> Cookies, caché y sesiones del motor Chromium
 *   ├── Documentos/    -> Archivos PDF y documentos descargados
 *   │     ├── Tarjetones/
 *   │     ├── Escritos/
 *   │     └── Biometricos/
 *   └── Seguridad/     -> Bóveda cifrada de credenciales y PIN maestro
 *
 * Los nombres son limpios y transparentes para no generar desconfianza en equipos institucionales.
 */
export function initializePortablePaths(): PortablePaths {
  // Determinar la raíz de ejecución
  let rootDir: string;

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    // Si fue empaquetado como portable con electron-builder
    rootDir = process.env.PORTABLE_EXECUTABLE_DIR;
  } else if (app.isPackaged) {
    rootDir = path.dirname(process.execPath);
  } else {
    // En desarrollo: carpeta local dentro de desktop-app
    rootDir = path.resolve(__dirname, '../../');
  }

  const dataDir = path.join(rootDir, 'Datos');
  const profileDir = path.join(dataDir, 'Perfil');
  const documentsDir = path.join(dataDir, 'Documentos');
  const tarjetonesDir = path.join(documentsDir, 'Tarjetones');
  const escritosDir = path.join(documentsDir, 'Escritos');
  const biometricosDir = path.join(documentsDir, 'Biometricos');
  const securityDir = path.join(dataDir, 'Seguridad');

  // Asegurar que existan todos los directorios
  const dirs = [
    dataDir,
    profileDir,
    documentsDir,
    tarjetonesDir,
    escritosDir,
    biometricosDir,
    securityDir,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error(`Error creando directorio portátil: ${dir}`, err);
      }
    }
  }

  // Redirigir el almacenamiento de Chromium userData a la carpeta Perfil en la USB
  try {
    app.setPath('userData', profileDir);
    app.setPath('sessionData', profileDir);
  } catch (err) {
    console.warn('No se pudo redirigir userData de app inmediatamente:', err);
  }

  return {
    rootDir,
    dataDir,
    profileDir,
    documentsDir,
    tarjetonesDir,
    escritosDir,
    biometricosDir,
    securityDir,
  };
}
