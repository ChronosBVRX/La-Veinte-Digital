#!/usr/bin/env node

/**
 * deploy-oci-web.mjs
 * Script de empaquetado y despliegue automatizado de Next.js Standalone a Oracle Cloud Always Free VPS.
 * 
 * Flujo:
 * 1. Verifica la existencia de .next/standalone (o ejecuta build con --build).
 * 2. Prepara la estructura standalone copiando .next/static y public/.
 * 3. Empaqueta el bundle en deploy-web.tar.gz.
 * 4. Transfiere vía SCP el bundle y las variables de producción a /opt/laveinte-app.
 * 5. Construye la imagen Docker ARM64 en el VPS y arranca laveinte-web.
 * 6. Verifica la salud del servicio en http://127.0.0.1:3000/api/health.
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const VPS_IP = process.env.OCI_VPS_IP || "159.54.146.146";
const VPS_USER = process.env.OCI_VPS_USER || "opc";
const SSH_KEY = process.env.OCI_SSH_KEY || path.join(os.homedir(), ".ssh", "oci_key_3");
const REMOTE_DIR = "/opt/laveinte-app";

function runLocal(cmd, options = {}) {
  console.log(`[local] $ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...options });
}

function runRemote(cmd) {
  console.log(`[remote] $ ${cmd}`);
  const sshArgs = [
    "-i", SSH_KEY,
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ConnectTimeout=30",
    "-o", "ServerAliveInterval=15",
    `${VPS_USER}@${VPS_IP}`,
    cmd,
  ];
  const res = spawnSync("ssh", sshArgs, { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`Comando remoto falló con código ${res.status}`);
  }
}

function scpUpload(localPath, remotePath, maxRetries = 3) {
  console.log(`[scp] ${localPath} -> ${remotePath}`);
  const scpArgs = [
    "-i", SSH_KEY,
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ConnectTimeout=30",
    "-o", "ServerAliveInterval=15",
    localPath,
    `${VPS_USER}@${VPS_IP}:${remotePath}`,
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = spawnSync("scp", scpArgs, { stdio: "inherit" });
    if (res.status === 0) {
      return;
    }
    console.warn(`[scp] Intento ${attempt}/${maxRetries} falló con código ${res.status}.`);
    if (attempt < maxRetries) {
      console.log(`[scp] Reintentando en 5 segundos...`);
      spawnSync("node", ["-e", "setTimeout(() => {}, 5000)"]);
    } else {
      throw new Error(`SCP falló tras ${maxRetries} intentos con código ${res.status}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldBuild = args.includes("--build");

  console.log("=== DESPLIEGUE NEXT.JS A ORACLE CLOUD (ARM64) ===");
  console.log(`VPS: ${VPS_USER}@${VPS_IP}`);
  console.log(`SSH Key: ${SSH_KEY}`);
  console.log(`Destino: ${REMOTE_DIR}`);

  if (!fs.existsSync(SSH_KEY)) {
    console.error(`ERROR: Llave SSH no encontrada en ${SSH_KEY}`);
    process.exit(1);
  }

  // 1. Compilación opcional
  if (shouldBuild) {
    console.log("\n[1/6] Compilando Next.js en modo standalone...");
    runLocal("npm run build");
  } else {
    console.log("\n[1/6] Verificando build standalone previo...");
    if (!fs.existsSync(path.join(process.cwd(), ".next", "standalone"))) {
      console.log(".next/standalone no encontrado. Ejecutando build...");
      runLocal("npm run build");
    }
  }

  // 2. Localizar dónde Next.js colocó el standalone
  console.log("\n[2/6] Preparando bundle standalone...");
  const standaloneDir = path.join(process.cwd(), ".next", "standalone");
  const staticDir = path.join(process.cwd(), ".next", "static");
  const publicDir = path.join(process.cwd(), "public");

  // En monorepos, Next.js a veces anida el server en standalone/<repo-name>/server.js
  // Busquemos dónde está server.js
  let appStandaloneRoot = standaloneDir;
  if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
    const candidates = fs.readdirSync(standaloneDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(standaloneDir, d.name));
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, "server.js"))) {
        appStandaloneRoot = c;
        break;
      }
    }
  }

  console.log(`Standalone server root: ${appStandaloneRoot}`);

  // 3. Preparar directorio staging limpio para el contenedor
  console.log("\n[3/6] Preparando directorio staging limpio...");
  const stagingDir = path.join(process.cwd(), ".next", "deploy-staging");
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  // Copiar solo lo estrictamente necesario para producción
  console.log("Copiando artefactos esenciales al staging...");
  fs.copyFileSync(path.join(appStandaloneRoot, "server.js"), path.join(stagingDir, "server.js"));
  if (fs.existsSync(path.join(appStandaloneRoot, "package.json"))) {
    fs.copyFileSync(path.join(appStandaloneRoot, "package.json"), path.join(stagingDir, "package.json"));
  }

  // Copiar node_modules
  if (fs.existsSync(path.join(appStandaloneRoot, "node_modules"))) {
    console.log("Copiando node_modules de standalone...");
    fs.cpSync(path.join(appStandaloneRoot, "node_modules"), path.join(stagingDir, "node_modules"), { recursive: true });
  }

  // Copiar .next compilado
  if (fs.existsSync(path.join(appStandaloneRoot, ".next"))) {
    console.log("Copiando .next compilado...");
    fs.cpSync(path.join(appStandaloneRoot, ".next"), path.join(stagingDir, ".next"), { recursive: true });
  }

  // Copiar .next/static (requerido por Next.js standalone para servir CSS y JS estáticos)
  if (fs.existsSync(staticDir)) {
    console.log("Copiando .next/static...");
    fs.cpSync(staticDir, path.join(stagingDir, ".next", "static"), { recursive: true });
  }

  // Copiar public
  if (fs.existsSync(publicDir)) {
    console.log("Copiando public/...");
    fs.cpSync(publicDir, path.join(stagingDir, "public"), { recursive: true });
  }

  // Copiar Dockerfile.web
  fs.copyFileSync(
    path.join(process.cwd(), "Dockerfile.web"),
    path.join(stagingDir, "Dockerfile")
  );

  // Generar docker-compose.yml en staging
  const dockerComposeContent = `services:
  web:
    image: laveinte-web:latest
    build:
      context: .
      dockerfile: Dockerfile
    container_name: laveinte-web
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOSTNAME=0.0.0.0
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"
`;
  fs.writeFileSync(path.join(stagingDir, "docker-compose.yml"), dockerComposeContent);

  // Crear archivo tar.gz desde stagingDir
  console.log("Empaquetando bundle comprimido...");
  const tarballPath = path.join(process.cwd(), "deploy-web.tar.gz");
  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }

  runLocal(`tar -czf "${tarballPath}" -C "${stagingDir}" .`);
  const stats = fs.statSync(tarballPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`Bundle creado con éxito: ${tarballPath} (${sizeMB} MB)`);

  // 4. Preparar variables de entorno de producción
  console.log("\n[4/6] Preparando archivo .env para el servidor...");
  const envProdLocal = path.join(process.cwd(), ".env.production.local");
  const tempEnvPath = path.join(process.cwd(), ".env.deploy.tmp");

  if (fs.existsSync(envProdLocal)) {
    let envContent = fs.readFileSync(envProdLocal, "utf8");
    // Limpiar variables de Turborepo / Vercel específicas de CI y comillas externas literales
    const cleanedLines = envContent.split(/\r?\n/).filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return true;
      if (trimmed.startsWith("TURBO_") || trimmed.startsWith("NX_") || trimmed.startsWith("VERCEL_GIT_")) return false;
      return true;
    }).map((line) => {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (!match) return line;
      const key = match[1];
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return `${key}=${val}`;
    });
    let currentSha = "dev";
    try {
      currentSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch {}
    cleanedLines.push(`APP_COMMIT_SHA=${currentSha}`);
    fs.writeFileSync(tempEnvPath, cleanedLines.join("\n"));
  } else {
    console.error("ERROR: .env.production.local no existe.");
    process.exit(1);
  }

  // 5. Transferir a VPS
  console.log("\n[5/6] Transfiriendo bundle y configuración al VPS...");
  runRemote(`sudo mkdir -p ${REMOTE_DIR} && sudo chown -R ${VPS_USER}:${VPS_USER} ${REMOTE_DIR}`);
  scpUpload(tarballPath, `${REMOTE_DIR}/deploy-web.tar.gz`);
  scpUpload(tempEnvPath, `${REMOTE_DIR}/.env`);

  // Limpiar archivo temporal local
  fs.unlinkSync(tempEnvPath);

  // 6. Extraer, compilar imagen Docker y arrancar contenedor
  console.log("\n[6/6] Desplegando contenedor en VPS...");
  const remoteDeployScript = `
    set -e
    cd ${REMOTE_DIR}
    tar -xzf deploy-web.tar.gz
    rm -f deploy-web.tar.gz
    chmod 600 .env
    
    echo "Construyendo imagen Docker laveinte-web..."
    docker compose build web
    
    echo "Iniciando contenedor laveinte-web..."
    docker compose up -d --remove-orphans web
    
    echo "Esperando a que el contenedor esté listo..."
    sleep 5
    
    echo "Verificando endpoint de salud..."
    curl -sS -i http://127.0.0.1:3000/api/health
    echo ""
    docker ps --filter name=laveinte-web
  `;

  runRemote(remoteDeployScript);

  console.log("\n========================================================");
  console.log("✅ DESPLIEGUE A OCI COMPLETADO CON ÉXITO");
  console.log("========================================================");
}

main().catch((err) => {
  console.error("ERROR EN DESPLIEGUE:", err);
  process.exit(1);
});
